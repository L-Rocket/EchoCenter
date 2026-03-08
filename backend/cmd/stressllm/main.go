package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type loginResponse struct {
	Token string `json:"token"`
}

type result struct {
	latency time.Duration
	ok      bool
	code    int
	err     error
}

func main() {
	baseURL := envOr("STRESS_BASE_URL", "http://localhost:8080")
	username := envOr("STRESS_ADMIN_USER", "admin")
	password := envOr("STRESS_ADMIN_PASS", "admin123")
	concurrency := envIntOr("STRESS_CONCURRENCY", 200)
	totalRequests := envIntOr("STRESS_REQUESTS", 2000)
	timeout := envDurationOr("STRESS_TIMEOUT", 30*time.Second)
	prompt := envOr("STRESS_PROMPT", "stress-llm")

	if concurrency <= 0 || totalRequests <= 0 {
		fatalf("STRESS_CONCURRENCY and STRESS_REQUESTS must be positive")
	}
	if concurrency > totalRequests {
		concurrency = totalRequests
	}

	client := &http.Client{Timeout: timeout}
	token, err := login(client, baseURL, username, password)
	if err != nil {
		fatalf("login failed: %v", err)
	}

	fmt.Printf("stress-llm start: base=%s requests=%d concurrency=%d timeout=%s\n", baseURL, totalRequests, concurrency, timeout)

	jobs := make(chan int, totalRequests)
	results := make(chan result, totalRequests)

	var started int64
	var wg sync.WaitGroup
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for seq := range jobs {
				atomic.AddInt64(&started, 1)
				payload := fmt.Sprintf("%s worker=%d seq=%d", prompt, workerID, seq)
				res := hitOnce(client, token, baseURL, payload)
				results <- res
			}
		}(i + 1)
	}

	start := time.Now()
	for i := 0; i < totalRequests; i++ {
		jobs <- i + 1
	}
	close(jobs)
	wg.Wait()
	close(results)
	totalTime := time.Since(start)

	var okCount int
	var failCount int
	var latencySum time.Duration
	latencies := make([]time.Duration, 0, totalRequests)
	codeCounter := map[int]int{}
	errCounter := map[string]int{}

	for r := range results {
		if r.ok {
			okCount++
			latencies = append(latencies, r.latency)
			latencySum += r.latency
		} else {
			failCount++
		}
		if r.code != 0 {
			codeCounter[r.code]++
		}
		if r.err != nil {
			errCounter[r.err.Error()]++
		}
	}

	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })

	fmt.Printf("started=%d completed=%d success=%d failed=%d\n", started, okCount+failCount, okCount, failCount)
	fmt.Printf("wall_time=%s throughput=%.2f req/s\n", totalTime, float64(okCount+failCount)/totalTime.Seconds())

	if okCount > 0 {
		avg := latencySum / time.Duration(okCount)
		fmt.Printf(
			"latency: min=%s p50=%s p95=%s p99=%s max=%s avg=%s\n",
			latencies[0],
			percentile(latencies, 0.50),
			percentile(latencies, 0.95),
			percentile(latencies, 0.99),
			latencies[len(latencies)-1],
			avg,
		)
	}

	if len(codeCounter) > 0 {
		fmt.Println("status_codes:")
		for _, code := range sortedCodes(codeCounter) {
			fmt.Printf("  %d => %d\n", code, codeCounter[code])
		}
	}

	if len(errCounter) > 0 {
		fmt.Println("errors:")
		for msg, n := range errCounter {
			fmt.Printf("  %s => %d\n", msg, n)
		}
	}

	if failCount > 0 {
		os.Exit(1)
	}
}

func login(client *http.Client, baseURL, username, password string) (string, error) {
	body := map[string]string{
		"username": username,
		"password": password,
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/auth/login", bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status=%d body=%s", resp.StatusCode, string(data))
	}

	var lr loginResponse
	if err := json.Unmarshal(data, &lr); err != nil {
		return "", err
	}
	if strings.TrimSpace(lr.Token) == "" {
		return "", fmt.Errorf("empty token in login response")
	}
	return lr.Token, nil
}

func hitOnce(client *http.Client, token, baseURL, content string) result {
	body := map[string]string{
		"content": content,
	}
	b, _ := json.Marshal(body)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, strings.TrimRight(baseURL, "/")+"/api/dev/mock/butler-chat", bytes.NewReader(b))
	if err != nil {
		return result{err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start)
	if err != nil {
		return result{latency: latency, err: err}
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return result{
			latency: latency,
			ok:      false,
			code:    resp.StatusCode,
			err:     fmt.Errorf("status=%d body=%s", resp.StatusCode, string(data)),
		}
	}

	return result{
		latency: latency,
		ok:      true,
		code:    resp.StatusCode,
	}
}

func envOr(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}

func envIntOr(key string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func envDurationOr(key string, fallback time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return fallback
	}
	return d
}

func percentile(latencies []time.Duration, p float64) time.Duration {
	if len(latencies) == 0 {
		return 0
	}
	if p <= 0 {
		return latencies[0]
	}
	if p >= 1 {
		return latencies[len(latencies)-1]
	}
	idx := int(float64(len(latencies)-1) * p)
	return latencies[idx]
}

func sortedCodes(counter map[int]int) []int {
	codes := make([]int, 0, len(counter))
	for code := range counter {
		codes = append(codes, code)
	}
	sort.Ints(codes)
	return codes
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "ERROR: "+format+"\n", args...)
	os.Exit(2)
}
