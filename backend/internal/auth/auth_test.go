package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/config"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func testService(secret string) Service {
	return NewService(&config.AuthConfig{
		JWTSecret:       secret,
		TokenExpiration: time.Hour,
		BcryptCost:      4,
	}, nil)
}

func TestGenerateAndValidateToken(t *testing.T) {
	svc := testService("12345678901234567890123456789012")

	token, err := svc.GenerateToken(42, "ADMIN")
	require.NoError(t, err)
	require.NotEmpty(t, token)

	claims, err := svc.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, 42, claims.UserID)
	assert.Equal(t, "ADMIN", claims.Role)
	assert.Equal(t, "echocenter", claims.Issuer)
}

func TestValidateTokenWithWrongSecret(t *testing.T) {
	issuer := testService("12345678901234567890123456789012")
	validator := testService("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")

	token, err := issuer.GenerateToken(1, "MEMBER")
	require.NoError(t, err)

	claims, err := validator.ValidateToken(token)
	assert.Nil(t, claims)
	assert.Error(t, err)
	assert.True(t, apperrors.Is(err, apperrors.ErrTokenInvalid))
}

func TestHashAndVerifyPassword(t *testing.T) {
	svc := testService("12345678901234567890123456789012")

	hash, err := svc.HashPassword("super-secret")
	require.NoError(t, err)
	assert.NotEmpty(t, hash)
	assert.NotEqual(t, "super-secret", hash)

	assert.NoError(t, svc.VerifyPassword(hash, "super-secret"))
	assert.True(t, apperrors.Is(svc.VerifyPassword(hash, "wrong"), apperrors.ErrInvalidCredentials))
}

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := testService("12345678901234567890123456789012")

	t.Run("missing authorization header", func(t *testing.T) {
		r := gin.New()
		r.Use(svc.AuthMiddleware())
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/protected", nil)
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
		var body map[string]string
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		assert.Equal(t, "authorization header required", body["error"])
	})

	t.Run("invalid authorization format", func(t *testing.T) {
		r := gin.New()
		r.Use(svc.AuthMiddleware())
		r.GET("/protected", func(c *gin.Context) { c.Status(http.StatusOK) })

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/protected", nil)
		req.Header.Set("Authorization", "invalid")
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("valid token sets context", func(t *testing.T) {
		token, err := svc.GenerateToken(7, "ADMIN")
		require.NoError(t, err)

		r := gin.New()
		r.Use(svc.AuthMiddleware())
		r.GET("/protected", func(c *gin.Context) {
			uid, ok := c.Get("user_id")
			require.True(t, ok)
			role, ok := c.Get("user_role")
			require.True(t, ok)
			assert.Equal(t, 7, uid)
			assert.Equal(t, "ADMIN", role)
			c.Status(http.StatusOK)
		})

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/protected", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
	})
}

func TestAdminOnlyMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := testService("12345678901234567890123456789012")

	t.Run("missing role in context", func(t *testing.T) {
		r := gin.New()
		r.Use(svc.AdminOnlyMiddleware())
		r.GET("/admin", func(c *gin.Context) { c.Status(http.StatusOK) })

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("non-admin role denied", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("user_role", "MEMBER")
			c.Next()
		})
		r.Use(svc.AdminOnlyMiddleware())
		r.GET("/admin", func(c *gin.Context) { c.Status(http.StatusOK) })

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("admin role allowed", func(t *testing.T) {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("user_role", "ADMIN")
			c.Next()
		})
		r.Use(svc.AdminOnlyMiddleware())
		r.GET("/admin", func(c *gin.Context) { c.Status(http.StatusOK) })

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/admin", nil)
		r.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
	})
}
