package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

type config struct {
	wsURL          string
	loginURL       string
	token          string
	username       string
	password       string
	sourceIPs      string
	connections    int
	workers        int
	connectRate    int
	connectTimeout time.Duration
	holdDuration   time.Duration
	pingInterval   time.Duration
	statsInterval  time.Duration
	readTimeout    time.Duration
	backendPID     int
}

type loginResponse struct {
	Token string `json:"token"`
}

type procStatus struct {
	vmRSSKB  int64
	vmSizeKB int64
	threads  int64
}

type stats struct {
	attempted atomic.Int64
	success   atomic.Int64
	failed    atomic.Int64
	active    atomic.Int64

	errMu       sync.Mutex
	errKinds    map[string]int64
	errSamples  map[string][]string
	sampleLimit int
}

func newStats() *stats {
	return &stats{
		errKinds:    make(map[string]int64),
		errSamples:  make(map[string][]string),
		sampleLimit: 5,
	}
}

func (s *stats) addError(kind string) {
	s.addErrorWithDetail(kind, "")
}

func (s *stats) addErrorWithDetail(kind, detail string) {
	s.failed.Add(1)
	s.errMu.Lock()
	s.errKinds[kind]++
	if strings.TrimSpace(detail) != "" && len(s.errSamples[kind]) < s.sampleLimit {
		s.errSamples[kind] = append(s.errSamples[kind], detail)
	}
	s.errMu.Unlock()
}

func (s *stats) snapshotErrors() (map[string]int64, map[string][]string) {
	s.errMu.Lock()
	defer s.errMu.Unlock()
	out := make(map[string]int64, len(s.errKinds))
	for k, v := range s.errKinds {
		out[k] = v
	}
	samples := make(map[string][]string, len(s.errSamples))
	for k, v := range s.errSamples {
		cp := make([]string, len(v))
		copy(cp, v)
		samples[k] = cp
	}
	return out, samples
}

func main() {
	cfg := parseFlags()
	if cfg.connections <= 0 {
		log.Fatal("--connections must be > 0")
	}
	if cfg.workers <= 0 {
		log.Fatal("--workers must be > 0")
	}
	if cfg.pingInterval <= 0 {
		log.Fatal("--ping-interval must be > 0")
	}
	if cfg.statsInterval <= 0 {
		log.Fatal("--stats-interval must be > 0")
	}
	if cfg.readTimeout <= 0 {
		log.Fatal("--read-timeout must be > 0")
	}

	token := strings.TrimSpace(cfg.token)
	if token == "" {
		if strings.TrimSpace(cfg.username) == "" || strings.TrimSpace(cfg.password) == "" {
			log.Fatal("token is empty: provide --token or both --username and --password")
		}
		var err error
		token, err = login(context.Background(), cfg.loginURL, cfg.username, cfg.password, cfg.connectTimeout)
		if err != nil {
			log.Fatalf("login failed: %v", err)
		}
		log.Printf("login ok, token length=%d", len(token))
	}

	targetWSURL, err := withToken(cfg.wsURL, token)
	if err != nil {
		log.Fatalf("build ws url failed: %v", err)
	}

	log.Printf("start websocket stress: target=%s connections=%d workers=%d connect-rate=%d/s hold=%s",
		targetWSURL, cfg.connections, cfg.workers, cfg.connectRate, cfg.holdDuration)
	log.Printf("dial source IPs: %s", cfg.sourceIPs)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		log.Printf("received signal %s, shutting down", sig)
		cancel()
	}()

	s := newStats()
	var connWG sync.WaitGroup
	startReporter(ctx, s, cfg)

	startConnect := time.Now()
	connectAll(ctx, &connWG, cfg, targetWSURL, s)
	connectElapsed := time.Since(startConnect)

	attempted := s.attempted.Load()
	success := s.success.Load()
	failed := s.failed.Load()
	successRate := 0.0
	if attempted > 0 {
		successRate = float64(success) / float64(attempted) * 100
	}

	log.Printf("connect phase done: attempted=%d success=%d failed=%d success_rate=%.2f%% elapsed=%s",
		attempted, success, failed, successRate, connectElapsed)

	if cfg.holdDuration > 0 {
		select {
		case <-ctx.Done():
		case <-time.After(cfg.holdDuration):
			log.Printf("hold duration reached: %s", cfg.holdDuration)
		}
	} else {
		<-ctx.Done()
	}

	cancel()
	connWG.Wait()

	finalAttempted := s.attempted.Load()
	finalSuccess := s.success.Load()
	finalFailed := s.failed.Load()
	finalActive := s.active.Load()
	finalSuccessRate := 0.0
	if finalAttempted > 0 {
		finalSuccessRate = float64(finalSuccess) / float64(finalAttempted) * 100
	}

	log.Printf("final summary: attempted=%d success=%d failed=%d active=%d success_rate=%.2f%%",
		finalAttempted, finalSuccess, finalFailed, finalActive, finalSuccessRate)
	errKinds, errSamples := s.snapshotErrors()
	printErrorBreakdown(errKinds, errSamples)
}

func parseFlags() config {
	cfg := config{}
	flag.StringVar(&cfg.wsURL, "ws-url", "ws://127.0.0.1:8080/api/ws", "WebSocket URL (without token query is fine)")
	flag.StringVar(&cfg.loginURL, "login-url", "", "Login URL, defaults to <ws host>/api/auth/login")
	flag.StringVar(&cfg.token, "token", "", "Bearer token for /api/ws?token=...")
	flag.StringVar(&cfg.username, "username", "", "username for auto login")
	flag.StringVar(&cfg.password, "password", "", "password for auto login")
	flag.StringVar(&cfg.sourceIPs, "source-ips", "127.0.0.1", "comma-separated source IPs for outbound dials, e.g. 127.0.0.1,127.0.0.2")
	flag.IntVar(&cfg.connections, "connections", 10000, "target concurrent websocket connections")
	flag.IntVar(&cfg.workers, "workers", 300, "parallel dial workers")
	flag.IntVar(&cfg.connectRate, "connect-rate", 1000, "connection attempts per second (0 means unlimited)")
	flag.DurationVar(&cfg.connectTimeout, "connect-timeout", 8*time.Second, "single dial/login timeout")
	flag.DurationVar(&cfg.holdDuration, "hold", 2*time.Minute, "how long to keep established connections")
	flag.DurationVar(&cfg.pingInterval, "ping-interval", 20*time.Second, "client ping interval")
	flag.DurationVar(&cfg.statsInterval, "stats-interval", 5*time.Second, "stats print interval")
	flag.DurationVar(&cfg.readTimeout, "read-timeout", 75*time.Second, "websocket read deadline")
	flag.IntVar(&cfg.backendPID, "backend-pid", 0, "optional: backend process PID for RSS/threads tracking")
	flag.Parse()

	if strings.TrimSpace(cfg.loginURL) == "" {
		cfg.loginURL = deriveLoginURL(cfg.wsURL)
	}
	return cfg
}

func deriveLoginURL(wsURL string) string {
	u, err := url.Parse(wsURL)
	if err != nil || u.Host == "" {
		return "http://127.0.0.1:8080/api/auth/login"
	}
	if u.Scheme == "ws" {
		u.Scheme = "http"
	} else if u.Scheme == "wss" {
		u.Scheme = "https"
	}
	u.Path = "/api/auth/login"
	u.RawQuery = ""
	u.Fragment = ""
	return u.String()
}

func login(ctx context.Context, loginURL, username, password string, timeout time.Duration) (string, error) {
	payload := map[string]string{
		"username": username,
		"password": password,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, loginURL, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("login status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var data loginResponse
	if err := json.Unmarshal(respBody, &data); err != nil {
		return "", fmt.Errorf("parse login response failed: %w", err)
	}
	if strings.TrimSpace(data.Token) == "" {
		return "", errors.New("empty token in login response")
	}
	return data.Token, nil
}

func withToken(rawURL, token string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("token", token)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func parseSourceIPs(raw string) []string {
	items := strings.Split(raw, ",")
	out := make([]string, 0, len(items))
	for _, item := range items {
		ip := strings.TrimSpace(item)
		if ip == "" {
			continue
		}
		parsed := net.ParseIP(ip)
		if parsed == nil || parsed.To4() == nil {
			log.Fatalf("invalid source ip: %q", ip)
		}
		out = append(out, parsed.String())
	}
	if len(out) == 0 {
		log.Fatal("no valid source IPs provided")
	}
	return out
}

func connectAll(ctx context.Context, connWG *sync.WaitGroup, cfg config, targetWSURL string, s *stats) {
	jobs := make(chan int, cfg.workers*2)
	var workerWG sync.WaitGroup
	sourceIPs := parseSourceIPs(cfg.sourceIPs)

	for i := 0; i < cfg.workers; i++ {
		workerWG.Add(1)
		go func() {
			defer workerWG.Done()
			dialer := websocket.Dialer{
				HandshakeTimeout:  cfg.connectTimeout,
				EnableCompression: false,
			}
			for id := range jobs {
				if ctx.Err() != nil {
					return
				}
				s.attempted.Add(1)

				dialCtx, cancel := context.WithTimeout(ctx, cfg.connectTimeout)
				localIP := sourceIPs[(id-1)%len(sourceIPs)]
				dialer.NetDialContext = (&net.Dialer{
					Timeout: cfg.connectTimeout,
					LocalAddr: &net.TCPAddr{
						IP: net.ParseIP(localIP),
					},
				}).DialContext
				conn, resp, err := dialer.DialContext(dialCtx, targetWSURL, nil)
				cancel()
				if err != nil {
					reason := classifyDialError(err)
					if resp != nil {
						reason = fmt.Sprintf("http_%d", resp.StatusCode)
					}
					s.addErrorWithDetail(reason, strings.TrimSpace(err.Error()))
					continue
				}

				s.success.Add(1)
				s.active.Add(1)
				startConnectionLoops(ctx, connWG, cfg, s, id, conn)
			}
		}()
	}

	if cfg.connectRate <= 0 {
	enqueueUnlimited:
		for i := 1; i <= cfg.connections; i++ {
			select {
			case <-ctx.Done():
				break enqueueUnlimited
			case jobs <- i:
			}
		}
	} else {
		interval := time.Second / time.Duration(cfg.connectRate)
		if interval <= 0 {
			interval = time.Microsecond
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
	enqueueRateLimited:
		for i := 1; i <= cfg.connections; i++ {
			select {
			case <-ctx.Done():
				break enqueueRateLimited
			case <-ticker.C:
				select {
				case <-ctx.Done():
					break enqueueRateLimited
				case jobs <- i:
				}
			}
		}
	}

	close(jobs)
	workerWG.Wait()
}

func startConnectionLoops(ctx context.Context, connWG *sync.WaitGroup, cfg config, s *stats, id int, conn *websocket.Conn) {
	connWG.Add(1)
	go func() {
		defer connWG.Done()
		defer s.active.Add(-1)
		defer conn.Close()

		conn.SetReadLimit(64 << 10)
		_ = conn.SetReadDeadline(time.Now().Add(cfg.readTimeout))
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(cfg.readTimeout))
		})

		readDone := make(chan error, 1)
		go func() {
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					readDone <- err
					return
				}
			}
		}()

		pingTicker := time.NewTicker(cfg.pingInterval)
		defer pingTicker.Stop()

		for {
			select {
			case <-ctx.Done():
				_ = conn.WriteControl(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, "stress test done"),
					time.Now().Add(2*time.Second),
				)
				return
			case err := <-readDone:
				if shouldCountReadError(err) {
					s.addErrorWithDetail(classifyReadError(err), strings.TrimSpace(err.Error()))
				}
				return
			case <-pingTicker.C:
				if err := conn.WriteControl(websocket.PingMessage, []byte(strconv.Itoa(id)), time.Now().Add(3*time.Second)); err != nil {
					s.addErrorWithDetail(classifyWriteError(err), strings.TrimSpace(err.Error()))
					return
				}
			}
		}
	}()
}

func shouldCountReadError(err error) bool {
	if err == nil {
		return false
	}
	if websocket.IsCloseError(err,
		websocket.CloseNormalClosure,
		websocket.CloseGoingAway,
		websocket.CloseNoStatusReceived,
	) {
		return false
	}
	return true
}

func classifyDialError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "too many open files"):
		return "emfile"
	case strings.Contains(msg, "cannot assign requested address"):
		return "eaddr_not_avail"
	case strings.Contains(msg, "connection refused"):
		return "connection_refused"
	case strings.Contains(msg, "i/o timeout"):
		return "dial_timeout"
	case strings.Contains(msg, "tls"):
		return "tls_error"
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return "dial_timeout"
	}
	return "dial_other"
}

func classifyReadError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "i/o timeout"):
		return "read_timeout"
	case strings.Contains(msg, "close 1006"):
		return "close_1006"
	case strings.Contains(msg, "connection reset by peer"):
		return "conn_reset"
	}
	return "read_other"
}

func classifyWriteError(err error) string {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "broken pipe"):
		return "broken_pipe"
	case strings.Contains(msg, "connection reset by peer"):
		return "conn_reset"
	case strings.Contains(msg, "i/o timeout"):
		return "write_timeout"
	}
	return "write_other"
}

func startReporter(ctx context.Context, s *stats, cfg config) {
	go func() {
		ticker := time.NewTicker(cfg.statsInterval)
		defer ticker.Stop()
		start := time.Now()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				attempted := s.attempted.Load()
				success := s.success.Load()
				failed := s.failed.Load()
				active := s.active.Load()
				successRate := 0.0
				if attempted > 0 {
					successRate = float64(success) / float64(attempted) * 100
				}

				var mem runtime.MemStats
				runtime.ReadMemStats(&mem)
				elapsed := time.Since(start).Round(time.Second)

				line := fmt.Sprintf(
					"[stats t=%s] attempted=%d success=%d failed=%d active=%d success_rate=%.2f%% client_goroutines=%d client_alloc=%.2fMB client_sys=%.2fMB",
					elapsed,
					attempted,
					success,
					failed,
					active,
					successRate,
					runtime.NumGoroutine(),
					float64(mem.Alloc)/(1024*1024),
					float64(mem.Sys)/(1024*1024),
				)

				if cfg.backendPID > 0 {
					st, err := readProcStatus(cfg.backendPID)
					if err != nil {
						line += fmt.Sprintf(" backend_pid=%d backend_status_err=%q", cfg.backendPID, err)
					} else {
						line += fmt.Sprintf(
							" backend_pid=%d backend_rss=%.2fMB backend_vms=%.2fMB backend_threads=%d",
							cfg.backendPID,
							float64(st.vmRSSKB)/1024,
							float64(st.vmSizeKB)/1024,
							st.threads,
						)
					}
				}

				log.Println(line)
			}
		}
	}()
}

func readProcStatus(pid int) (*procStatus, error) {
	path := fmt.Sprintf("/proc/%d/status", pid)
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	st := &procStatus{}
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "VmRSS:") {
			st.vmRSSKB = parseKB(line)
		} else if strings.HasPrefix(line, "VmSize:") {
			st.vmSizeKB = parseKB(line)
		} else if strings.HasPrefix(line, "Threads:") {
			st.threads = parseNum(line)
		}
	}
	return st, nil
}

func parseKB(line string) int64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}
	v, err := strconv.ParseInt(fields[1], 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func parseNum(line string) int64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}
	v, err := strconv.ParseInt(fields[1], 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func printErrorBreakdown(m map[string]int64, samples map[string][]string) {
	if len(m) == 0 {
		log.Println("error breakdown: none")
		return
	}
	log.Println("error breakdown:")
	for kind, count := range m {
		log.Printf("  - %s: %d", kind, count)
		for _, sample := range samples[kind] {
			log.Printf("      sample: %s", sample)
		}
	}
}
