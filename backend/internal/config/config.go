package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Auth     AuthConfig
	CORS     CORSConfig
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
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

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvAsInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvAsDuration("SERVER_READ_TIMEOUT", 15*time.Second),
			WriteTimeout: getEnvAsDuration("SERVER_WRITE_TIMEOUT", 15*time.Second),
		},
		Database: DatabaseConfig{
			Path:            getEnv("DB_PATH", "./echocenter.db"),
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
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.Auth.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	if len(c.Auth.JWTSecret) < 32 {
		return fmt.Errorf("JWT_SECRET must be at least 32 characters")
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

// getEnvAsSlice gets environment variable as slice with default value
func getEnvAsSlice(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		return []string{value}
	}
	return defaultValue
}
