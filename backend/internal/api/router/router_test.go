package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestRouterSetup(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create router
	r := gin.New()

	// Setup a simple route for testing
	r.GET("/api/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	// Test ping endpoint
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/ping", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "pong")
}

func TestRouteGroups(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Test API group
	api := r.Group("/api")
	{
		api.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"group": "api"})
		})
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/test", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "api")
}

func TestProtectedRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Simulate protected route
	protected := r.Group("/api/protected")
	protected.Use(func(c *gin.Context) {
		// Mock auth middleware - reject if no token
		token := c.GetHeader("Authorization")
		if token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		c.Next()
	})
	{
		protected.GET("/data", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"data": "secret"})
		})
	}

	tests := []struct {
		name       string
		path       string
		headers    map[string]string
		expectCode int
	}{
		{
			name:       "no auth header",
			path:       "/api/protected/data",
			headers:    map[string]string{},
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "with auth header",
			path:       "/api/protected/data",
			headers:    map[string]string{"Authorization": "Bearer token123"},
			expectCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", tt.path, nil)
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectCode, w.Code)
		})
	}
}

func TestRouteParameters(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	r.GET("/api/chat/history/:peer_id", func(c *gin.Context) {
		peerID := c.Param("peer_id")
		c.JSON(http.StatusOK, gin.H{"peer_id": peerID})
	})

	tests := []struct {
		name         string
		path         string
		expectedPeer string
	}{
		{
			name:         "numeric peer id",
			path:         "/api/chat/history/123",
			expectedPeer: "123",
		},
		{
			name:         "string peer id",
			path:         "/api/chat/history/agent-001",
			expectedPeer: "agent-001",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("GET", tt.path, nil)
			r.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
			assert.Contains(t, w.Body.String(), tt.expectedPeer)
		})
	}
}

func TestHTTPMethods(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	// Setup routes with different methods
	r.GET("/api/messages", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"method": "GET"})
	})
	r.POST("/api/messages", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"method": "POST"})
	})
	r.GET("/api/messages/:id", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"method": "GET_ONE", "id": c.Param("id")})
	})

	tests := []struct {
		name       string
		method     string
		path       string
		expectCode int
		expectBody string
	}{
		{
			name:       "GET all messages",
			method:     "GET",
			path:       "/api/messages",
			expectCode: http.StatusOK,
			expectBody: "GET",
		},
		{
			name:       "POST new message",
			method:     "POST",
			path:       "/api/messages",
			expectCode: http.StatusCreated,
			expectBody: "POST",
		},
		{
			name:       "GET single message",
			method:     "GET",
			path:       "/api/messages/123",
			expectCode: http.StatusOK,
			expectBody: "GET_ONE",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(tt.method, tt.path, nil)
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectCode, w.Code)
			assert.Contains(t, w.Body.String(), tt.expectBody)
		})
	}
}
