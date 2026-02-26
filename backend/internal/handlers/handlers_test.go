package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/database"
	"github.com/lea/echocenter/backend/internal/models"
)

func TestIngestMessageValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/messages", IngestMessage)

	tests := []struct {
		name         string
		payload      interface{}
		expectedCode int
	}{
		{
			name: "valid payload",
			payload: models.Message{
				AgentID: "agent-1",
				Level:   "INFO",
				Content: "Hello",
			},
			expectedCode: http.StatusCreated,
		},
		{
			name: "missing agent_id",
			payload: map[string]interface{}{
				"level":   "INFO",
				"content": "Hello",
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "missing level",
			payload: map[string]interface{}{
				"agent_id": "agent-1",
				"content":  "Hello",
			},
			expectedCode: http.StatusBadRequest,
		},
		{
			name: "missing content",
			payload: map[string]interface{}{
				"agent_id": "agent-1",
				"level":    "INFO",
			},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dbFile := "./echocenter_handler_test.db"
			database.InitDBPath(dbFile)
			defer func() {
				database.CloseDB()
				os.Remove(dbFile)
			}()

			jsonValue, _ := json.Marshal(tt.payload)
			req, _ := http.NewRequest("POST", "/api/messages", bytes.NewBuffer(jsonValue))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tt.expectedCode {
				t.Errorf("Expected status code %d, got %d", tt.expectedCode, w.Code)
			}
		})
	}
}
