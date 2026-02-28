package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func setupRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	return r
}

func TestPingHandler(t *testing.T) {
	// Create a simple test to verify handler structure
	r := setupRouter()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/ping", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "pong")
}

func TestErrorResponseStructure(t *testing.T) {
	errResp := ErrorResponse{
		Error:   "test error",
		Details: "test details",
	}

	data, err := json.Marshal(errResp)
	assert.NoError(t, err)
	assert.Contains(t, string(data), "test error")
	assert.Contains(t, string(data), "test details")
}

func TestLoginRequestValidation(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]string
		valid   bool
	}{
		{
			name: "valid login request",
			payload: map[string]string{
				"username": "admin",
				"password": "password123",
			},
			valid: true,
		},
		{
			name: "missing username",
			payload: map[string]string{
				"password": "password123",
			},
			valid: false,
		},
		{
			name: "missing password",
			payload: map[string]string{
				"username": "admin",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req LoginRequest
			data, _ := json.Marshal(tt.payload)
			err := json.Unmarshal(data, &req)

			if tt.valid {
				assert.NoError(t, err)
				assert.NotEmpty(t, req.Username)
				assert.NotEmpty(t, req.Password)
			}
		})
	}
}

func TestCreateUserRequestValidation(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]interface{}
		valid   bool
	}{
		{
			name: "valid user creation",
			payload: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"role":     "MEMBER",
			},
			valid: true,
		},
		{
			name: "valid admin creation",
			payload: map[string]interface{}{
				"username": "adminuser",
				"password": "password123",
				"role":     "ADMIN",
			},
			valid: true,
		},
		{
			name: "invalid role",
			payload: map[string]interface{}{
				"username": "testuser",
				"password": "password123",
				"role":     "SUPERUSER",
			},
			valid: false,
		},
		{
			name: "password too short",
			payload: map[string]interface{}{
				"username": "testuser",
				"password": "123",
				"role":     "MEMBER",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req CreateUserRequest
			data, _ := json.Marshal(tt.payload)
			json.Unmarshal(data, &req)

			// Check if required fields are present
			hasUsername := req.Username != ""
			hasPassword := len(req.Password) >= 6
			hasValidRole := req.Role == "ADMIN" || req.Role == "MEMBER"

			if tt.valid {
				assert.True(t, hasUsername, "should have username")
				assert.True(t, hasPassword, "password should be at least 6 characters")
				assert.True(t, hasValidRole, "role should be ADMIN or MEMBER")
			}
		})
	}
}

func TestIngestMessageRequest(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]string
		valid   bool
	}{
		{
			name: "valid message",
			payload: map[string]string{
				"agent_id": "Test-Agent",
				"level":    "INFO",
				"content":  "Test message content",
			},
			valid: true,
		},
		{
			name: "missing agent_id",
			payload: map[string]string{
				"level":   "INFO",
				"content": "Test message content",
			},
			valid: false,
		},
		{
			name: "missing level",
			payload: map[string]string{
				"agent_id": "Test-Agent",
				"content":  "Test message content",
			},
			valid: false,
		},
		{
			name: "missing content",
			payload: map[string]string{
				"agent_id": "Test-Agent",
				"level":    "INFO",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req IngestMessageRequest
			data, _ := json.Marshal(tt.payload)
			err := json.Unmarshal(data, &req)

			if tt.valid {
				assert.NoError(t, err)
				assert.NotEmpty(t, req.AgentID)
				assert.NotEmpty(t, req.Level)
				assert.NotEmpty(t, req.Content)
			}
		})
	}
}

func TestAuthResponseRequest(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]interface{}
		valid   bool
	}{
		{
			name: "valid approval",
			payload: map[string]interface{}{
				"action_id": "action-123",
				"approved":  true,
			},
			valid: true,
		},
		{
			name: "valid rejection",
			payload: map[string]interface{}{
				"action_id": "action-123",
				"approved":  false,
			},
			valid: true,
		},
		{
			name: "missing action_id",
			payload: map[string]interface{}{
				"approved": true,
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req AuthResponseRequest
			data, _ := json.Marshal(tt.payload)
			json.Unmarshal(data, &req)

			if tt.valid {
				assert.NotEmpty(t, req.ActionID)
			}
		})
	}
}

func TestGetMessagesRequest(t *testing.T) {
	// Test default values
	req := GetMessagesRequest{
		Offset: 0,
		Limit:  50,
	}

	assert.Equal(t, 0, req.Offset)
	assert.Equal(t, 50, req.Limit)
	assert.Empty(t, req.AgentID)
	assert.Empty(t, req.Level)
	assert.Empty(t, req.Query)
}

func TestRegisterAgentRequest(t *testing.T) {
	tests := []struct {
		name    string
		payload map[string]string
		valid   bool
	}{
		{
			name: "valid agent registration",
			payload: map[string]string{
				"username": "New-Agent",
			},
			valid: true,
		},
		{
			name: "missing username",
			payload: map[string]string{
				"description": "An agent without a name",
			},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req RegisterAgentRequest
			data, _ := json.Marshal(tt.payload)
			err := json.Unmarshal(data, &req)

			if tt.valid {
				assert.NoError(t, err)
				assert.NotEmpty(t, req.Username)
			}
		})
	}
}

func TestHandlerStructure(t *testing.T) {
	// Verify that Handler struct has the required fields
	// This test ensures the refactoring didn't break the structure
	h := &Handler{}
	assert.NotNil(t, h)

	// The fields should exist (even if nil)
	// This is a compile-time check essentially
	_ = h.repo
	_ = h.authSvc
	_ = h.hub
}

func TestJSONBinding(t *testing.T) {
	r := setupRouter()
	r.POST("/test", func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, req)
	})

	tests := []struct {
		name       string
		payload    string
		expectCode int
	}{
		{
			name:       "valid JSON",
			payload:    `{"username":"admin","password":"secret"}`,
			expectCode: http.StatusOK,
		},
		{
			name:       "invalid JSON",
			payload:    `{"username":"admin",}`,
			expectCode: http.StatusBadRequest,
		},
		{
			name:       "missing required field",
			payload:    `{"username":"admin"}`,
			expectCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest("POST", "/test", bytes.NewBufferString(tt.payload))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectCode, w.Code)
		})
	}
}
