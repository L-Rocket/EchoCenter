package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestValidateJWTSecretLength(t *testing.T) {
	cfg := &Config{Auth: AuthConfig{JWTSecret: "short"}}
	err := cfg.Validate()
	assert.Error(t, err)

	cfg.Auth.JWTSecret = "12345678901234567890123456789012"
	assert.NoError(t, cfg.Validate())
}

func TestGetEnvHelpers(t *testing.T) {
	t.Setenv("TEST_ENV_STRING", "value")
	t.Setenv("TEST_ENV_INT", "123")
	t.Setenv("TEST_ENV_BAD_INT", "abc")
	t.Setenv("TEST_ENV_DURATION", "2m")
	t.Setenv("TEST_ENV_BAD_DURATION", "xyz")
	t.Setenv("TEST_ENV_SLICE", "a,b,c")

	assert.Equal(t, "value", getEnv("TEST_ENV_STRING", "default"))
	assert.Equal(t, "default", getEnv("TEST_ENV_MISSING", "default"))

	assert.Equal(t, 123, getEnvAsInt("TEST_ENV_INT", 5))
	assert.Equal(t, 5, getEnvAsInt("TEST_ENV_BAD_INT", 5))
	assert.Equal(t, 5, getEnvAsInt("TEST_ENV_MISSING_INT", 5))

	assert.Equal(t, 2*time.Minute, getEnvAsDuration("TEST_ENV_DURATION", time.Second))
	assert.Equal(t, time.Second, getEnvAsDuration("TEST_ENV_BAD_DURATION", time.Second))
	assert.Equal(t, time.Second, getEnvAsDuration("TEST_ENV_MISSING_DURATION", time.Second))

	assert.Equal(t, []string{"a", "b", "c"}, getEnvAsSlice("TEST_ENV_SLICE", []string{"x"}))
	assert.Equal(t, []string{"x"}, getEnvAsSlice("TEST_ENV_MISSING_SLICE", []string{"x"}))
}

func TestLoadWithExplicitEnv(t *testing.T) {
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	t.Setenv("SERVER_PORT", "9090")
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("DB_DSN", "postgres://test:test@localhost:5432/testdb?sslmode=disable")
	t.Setenv("DB_PATH", "./tmp/test.db")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://a.local,http://b.local")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, 9090, cfg.Server.Port)
	assert.Equal(t, "postgres", cfg.Database.Driver)
	assert.Equal(t, "postgres://test:test@localhost:5432/testdb?sslmode=disable", cfg.Database.DSN)
	assert.Equal(t, "./tmp/test.db", cfg.Database.Path)
	assert.Equal(t, []string{"http://a.local", "http://b.local"}, cfg.CORS.AllowedOrigins)
}

func TestLoadFailsWhenJWTSecretTooShort(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "short")
	t.Cleanup(func() { _ = os.Unsetenv("JWT_SECRET") })

	cfg, err := Load()
	assert.Nil(t, cfg)
	assert.Error(t, err)
}
