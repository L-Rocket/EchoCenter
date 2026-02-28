package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		authHeader string
		expectCode int
		expectNext bool
	}{
		{
			name:       "no authorization header",
			authHeader: "",
			expectCode: http.StatusUnauthorized,
			expectNext: false,
		},
		{
			name:       "invalid format - no bearer",
			authHeader: "invalid_token",
			expectCode: http.StatusUnauthorized,
			expectNext: false,
		},
		{
			name:       "invalid format - wrong prefix",
			authHeader: "Basic dXNlcjpwYXNz",
			expectCode: http.StatusUnauthorized,
			expectNext: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()

			// Mock auth middleware
			r.Use(func(c *gin.Context) {
				authHeader := c.GetHeader("Authorization")
				if authHeader == "" {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
					return
				}

				// Simple validation: must start with "bearer "
				if len(authHeader) < 7 || authHeader[:7] != "bearer " {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
					return
				}

				// Token validation would happen here
				c.Next()
			})

			r.GET("/test", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"message": "success"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectCode, w.Code)
		})
	}
}

func TestAdminOnlyMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		userRole   string
		expectCode int
	}{
		{
			name:       "admin user",
			userRole:   "ADMIN",
			expectCode: http.StatusOK,
		},
		{
			name:       "member user",
			userRole:   "MEMBER",
			expectCode: http.StatusForbidden,
		},
		{
			name:       "agent user",
			userRole:   "AGENT",
			expectCode: http.StatusForbidden,
		},
		{
			name:       "no role in context",
			userRole:   "",
			expectCode: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := gin.New()

			// Set user role in context
			r.Use(func(c *gin.Context) {
				if tt.userRole != "" {
					c.Set("user_role", tt.userRole)
				}
				c.Next()
			})

			// Admin only middleware
			r.GET("/admin", func(c *gin.Context) {
				role, exists := c.Get("user_role")
				if !exists {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user context not found"})
					return
				}

				if role != "ADMIN" {
					c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
					return
				}

				c.JSON(http.StatusOK, gin.H{"message": "admin only"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", "/admin", nil)
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectCode, w.Code)
		})
	}
}

func TestContextValues(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Middleware that sets context values
	r.Use(func(c *gin.Context) {
		c.Set("user_id", 123)
		c.Set("user_role", "ADMIN")
		c.Next()
	})

	r.GET("/test", func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		assert.True(t, exists)
		assert.Equal(t, 123, userID)

		userRole, exists := c.Get("user_role")
		assert.True(t, exists)
		assert.Equal(t, "ADMIN", userRole)

		c.JSON(http.StatusOK, gin.H{
			"user_id":   userID,
			"user_role": userRole,
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "123")
	assert.Contains(t, w.Body.String(), "ADMIN")
}

func TestMiddlewareChain(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	executionOrder := []string{}

	// First middleware
	r.Use(func(c *gin.Context) {
		executionOrder = append(executionOrder, "middleware1_before")
		c.Next()
		executionOrder = append(executionOrder, "middleware1_after")
	})

	// Second middleware
	r.Use(func(c *gin.Context) {
		executionOrder = append(executionOrder, "middleware2_before")
		c.Next()
		executionOrder = append(executionOrder, "middleware2_after")
	})

	r.GET("/test", func(c *gin.Context) {
		executionOrder = append(executionOrder, "handler")
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, []string{
		"middleware1_before",
		"middleware2_before",
		"handler",
		"middleware2_after",
		"middleware1_after",
	}, executionOrder)
}
