package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Server        ServerConfig
	Database      DatabaseConfig
	Auth          AuthConfig
	CORS          CORSConfig
	FeishuWS      FeishuWSConfig
	OpenHands     OpenHandsConfig
	Observability ObservabilityConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Host         string
	Port         int
	Env          string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Driver          string
	DSN             string
	Path            string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// AuthConfig holds authentication configuration
type AuthConfig struct {
	JWTSecret            string
	TokenExpiration      time.Duration
	BcryptCost           int
	InitialAdminUser     string
	InitialAdminPassword string
}

// CORSConfig holds CORS configuration
type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
	MaxAge         int
}

// FeishuWSConfig holds Feishu long-connection (WebSocket) configuration.
type FeishuWSConfig struct {
	Enabled           bool
	URL               string
	ReconnectInterval time.Duration
}

// OpenHandsConfig holds the backend-managed OpenHands ops agent configuration.
type OpenHandsConfig struct {
	Enabled             bool
	ServiceURL          string
	PythonBin           string
	RunnerScript        string
	BaseURL             string
	APIKey              string
	Model               string
	WorkspaceDir        string
	SSHKeyEncryptionKey string
}

// ObservabilityConfig holds optional runtime observability integrations.
type ObservabilityConfig struct {
	CozeLoopEnabled bool
	ServiceName     string
	DeploymentEnv   string
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvAsInt("SERVER_PORT", 8080),
			Env:          getEnv("APP_ENV", "development"),
			ReadTimeout:  getEnvAsDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getEnvAsDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
		},
		Database: DatabaseConfig{
			Driver:          getEnv("DB_DRIVER", "sqlite"),
			DSN:             getPostgresDSN(),
			Path:            getEnv("DB_PATH", "./data/echo_center.db"),
			MaxOpenConns:    getEnvAsInt("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getEnvAsInt("DB_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getEnvAsDuration("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		Auth: AuthConfig{
			JWTSecret:            getEnv("JWT_SECRET", ""),
			TokenExpiration:      getEnvAsDuration("JWT_TOKEN_EXPIRATION", 24*time.Hour),
			BcryptCost:           getEnvAsInt("BCRYPT_COST", 12),
			InitialAdminUser:     getEnv("INITIAL_ADMIN_USER", ""),
			InitialAdminPassword: getEnv("INITIAL_ADMIN_PASS", ""),
		},
		CORS: CORSConfig{
			AllowedOrigins: getEnvAsSlice("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:5173"}),
			AllowedMethods: getEnvAsSlice("CORS_ALLOWED_METHODS", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
			AllowedHeaders: getEnvAsSlice("CORS_ALLOWED_HEADERS", []string{"Origin", "Content-Type", "Authorization"}),
			MaxAge:         getEnvAsInt("CORS_MAX_AGE", 86400),
		},
		FeishuWS: FeishuWSConfig{
			Enabled:           getEnvAsBool("FEISHU_WS_ENABLED", false),
			URL:               getEnv("FEISHU_WS_URL", "wss://open.feishu.cn/open-apis/ws/v2"),
			ReconnectInterval: getEnvAsDuration("FEISHU_WS_RECONNECT_INTERVAL", 5*time.Second),
		},
		OpenHands: OpenHandsConfig{
			Enabled:             getEnvAsBool("OPENHANDS_ENABLED", false),
			ServiceURL:          getEnv("OPENHANDS_SERVICE_URL", ""),
			PythonBin:           getEnv("OPENHANDS_PYTHON_BIN", "python3"),
			RunnerScript:        getEnv("OPENHANDS_RUNNER_SCRIPT", "./scripts/openhands_ops_runner.py"),
			BaseURL:             getEnv("OPENHANDS_BASE_URL", ""),
			APIKey:              getEnv("OPENHANDS_API_KEY", ""),
			Model:               getEnv("OPENHANDS_MODEL", ""),
			WorkspaceDir:        getEnv("OPENHANDS_WORKSPACE_DIR", "./data/openhands"),
			SSHKeyEncryptionKey: getEnv("OPENHANDS_SSH_KEY_ENCRYPTION_KEY", getEnv("JWT_SECRET", "")),
		},
		Observability: ObservabilityConfig{
			CozeLoopEnabled: getEnvAsBool("OBSERVABILITY_COZELOOP_ENABLED", false),
			ServiceName:     getEnv("OBSERVABILITY_SERVICE_NAME", "echocenter-backend"),
			DeploymentEnv:   getEnv("APP_ENV", "development"),
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if len(c.Auth.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters, got %d", len(c.Auth.JWTSecret))
	}
	return nil
}

// getEnv gets environment variable with default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt gets environment variable as int with default value
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

// getEnvAsDuration gets environment variable as duration with default value
func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		switch strings.ToLower(value) {
		case "1", "true", "yes", "on":
			return true
		case "0", "false", "no", "off":
			return false
		}
	}
	return defaultValue
}

// getEnvAsSlice gets environment variable as slice with default value
func getEnvAsSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return strings.Split(value, ",")
	}
	return defaultValue
}

// getPostgresDSN returns DB_DSN if set, otherwise builds DSN from PG_* variables.
func getPostgresDSN() string {
	if dsn := strings.TrimSpace(os.Getenv("DB_DSN")); dsn != "" {
		return dsn
	}

	host := getEnv("PG_HOST", "localhost")
	port := getEnvAsInt("PG_PORT", 5432)
	user := getEnv("PG_USER", "postgres")
	password := os.Getenv("PG_PASSWORD")
	database := getEnv("PG_DATABASE", "echocenter")
	sslMode := getEnv("PG_SSLMODE", "disable")

	u := &url.URL{
		Scheme:   "postgres",
		Host:     net.JoinHostPort(host, strconv.Itoa(port)),
		Path:     "/" + database,
		RawQuery: "sslmode=" + url.QueryEscape(sslMode),
	}
	if password != "" {
		u.User = url.UserPassword(user, password)
	} else {
		u.User = url.User(user)
	}

	return u.String()
}
