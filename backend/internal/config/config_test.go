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
	t.Setenv("APP_ENV", "development")
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("DB_DSN", "postgres://test:test@localhost:5432/testdb?sslmode=disable")
	t.Setenv("DB_PATH", "./tmp/test.db")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://a.local,http://b.local")
	t.Setenv("OBSERVABILITY_COZELOOP_ENABLED", "true")
	t.Setenv("OBSERVABILITY_SERVICE_NAME", "echocenter-test")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, 9090, cfg.Server.Port)
	assert.Equal(t, "development", cfg.Server.Env)
	assert.Equal(t, "postgres", cfg.Database.Driver)
	assert.Equal(t, "postgres://test:test@localhost:5432/testdb?sslmode=disable", cfg.Database.DSN)
	assert.Equal(t, "./tmp/test.db", cfg.Database.Path)
	assert.Equal(t, []string{"http://a.local", "http://b.local"}, cfg.CORS.AllowedOrigins)
	assert.True(t, cfg.Observability.CozeLoopEnabled)
	assert.Equal(t, "echocenter-test", cfg.Observability.ServiceName)
	assert.Equal(t, "development", cfg.Observability.DeploymentEnv)
}

func TestLoadBuildsPostgresDSNFromPGEnv(t *testing.T) {
	t.Setenv("JWT_SECRET", "12345678901234567890123456789012")
	t.Setenv("DB_DRIVER", "postgres")
	t.Setenv("PG_HOST", "127.0.0.1")
	t.Setenv("PG_PORT", "5433")
	t.Setenv("PG_USER", "demo")
	t.Setenv("PG_PASSWORD", "secret")
	t.Setenv("PG_DATABASE", "echocenter_dev")
	t.Setenv("PG_SSLMODE", "disable")
	t.Setenv("DB_DSN", "")

	cfg, err := Load()
	assert.NoError(t, err)
	assert.Equal(t, "postgres://demo:secret@127.0.0.1:5433/echocenter_dev?sslmode=disable", cfg.Database.DSN)
}

func TestLoadFailsWhenJWTSecretTooShort(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "short")
	t.Cleanup(func() { _ = os.Unsetenv("JWT_SECRET") })

	cfg, err := Load()
	assert.Nil(t, cfg)
	assert.Error(t, err)
}
