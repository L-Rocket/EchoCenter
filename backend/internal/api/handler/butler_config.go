package handler

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// GetButlerConfig returns the current Butler model configuration.
// If a DB record exists it takes priority; otherwise env vars are returned.
func (h *Handler) GetButlerConfig(c *gin.Context) {
	cfg, err := h.repo.GetButlerRuntimeConfig(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if cfg != nil {
		var updatedBy *string
		if cfg.UpdatedByID > 0 {
			user, _ := h.repo.GetUserByID(c.Request.Context(), cfg.UpdatedByID)
			if user != nil {
				s := user.Username
				updatedBy = &s
			}
		}
		c.JSON(http.StatusOK, gin.H{
			"model_name":     cfg.ModelName,
			"base_url":       cfg.BaseURL,
			"api_token_hint": maskTokenHint(cfg.APIToken),
			"config_source":  "db",
			"updated_at":     cfg.UpdatedAt,
			"updated_by":     updatedBy,
		})
		return
	}

	envBaseURL := os.Getenv("BUTLER_BASE_URL")
	envAPIToken := os.Getenv("BUTLER_API_TOKEN")
	envModel := os.Getenv("BUTLER_MODEL")

	configSource := "env"
	if envBaseURL == "" && envModel == "" && envAPIToken == "" {
		configSource = "none"
	}
	c.JSON(http.StatusOK, gin.H{
		"model_name":     envModel,
		"base_url":       envBaseURL,
		"api_token_hint": maskTokenHint(envAPIToken),
		"config_source":  configSource,
		"updated_at":     nil,
		"updated_by":     nil,
	})
}

type updateButlerConfigRequest struct {
	ModelName string `json:"model_name"`
	BaseURL   string `json:"base_url"`
	APIToken  string `json:"api_token"`
}

// UpdateButlerConfig persists a new Butler model configuration and hot-reloads the service.
func (h *Handler) UpdateButlerConfig(c *gin.Context) {
	var req updateButlerConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	req.ModelName = strings.TrimSpace(req.ModelName)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	req.APIToken = strings.TrimSpace(req.APIToken)

	if req.ModelName == "" || req.BaseURL == "" {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "model_name and base_url are required"))
		return
	}

	// Empty api_token means "keep the existing token".
	if req.APIToken == "" {
		if existing, err := h.repo.GetButlerRuntimeConfig(c.Request.Context()); err == nil && existing != nil {
			req.APIToken = existing.APIToken
		}
	}

	updatedByID := 0
	if uid, ok := c.Get("user_id"); ok {
		if id, ok := uid.(int); ok {
			updatedByID = id
		}
	}

	cfg := &models.ButlerRuntimeConfig{
		ModelName:   req.ModelName,
		BaseURL:     req.BaseURL,
		APIToken:    req.APIToken,
		UpdatedByID: updatedByID,
	}
	if err := h.repo.UpsertButlerRuntimeConfig(c.Request.Context(), cfg); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if svc := butler.GetButler(); svc != nil {
		svc.UpdateModelConfig(cfg.BaseURL, cfg.APIToken, cfg.ModelName)
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":            true,
		"config_source": "db",
	})
}

// ResetButlerConfig clears the DB configuration and reverts to env vars.
func (h *Handler) ResetButlerConfig(c *gin.Context) {
	if err := h.repo.DeleteButlerRuntimeConfig(c.Request.Context()); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	envBaseURL := os.Getenv("BUTLER_BASE_URL")
	envAPIToken := os.Getenv("BUTLER_API_TOKEN")
	envModel := os.Getenv("BUTLER_MODEL")

	if svc := butler.GetButler(); svc != nil {
		svc.UpdateModelConfig(envBaseURL, envAPIToken, envModel)
	}

	configSource := "env"
	if envBaseURL == "" && envModel == "" && envAPIToken == "" {
		configSource = "none"
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":            true,
		"config_source": configSource,
	})
}

type testButlerConnectivityRequest struct {
	ModelName string `json:"model_name"`
	BaseURL   string `json:"base_url"`
	APIToken  string `json:"api_token"`
}

// TestButlerConnectivity probes the given LLM endpoint without writing to DB.
func (h *Handler) TestButlerConnectivity(c *gin.Context) {
	var req testButlerConnectivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	req.ModelName = strings.TrimSpace(req.ModelName)
	req.BaseURL = strings.TrimSpace(req.BaseURL)

	if req.ModelName == "" || req.BaseURL == "" {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "model_name and base_url are required"))
		return
	}

	probeURL := strings.TrimRight(req.BaseURL, "/") + "/models"
	httpClient := &http.Client{Timeout: 10 * time.Second}

	probeReq, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, probeURL, nil)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"ok":         false,
			"message":    "无法构造探测请求：" + err.Error(),
			"latency_ms": int64(0),
		})
		return
	}
	if req.APIToken != "" {
		probeReq.Header.Set("Authorization", "Bearer "+req.APIToken)
	}

	start := time.Now()
	resp, err := httpClient.Do(probeReq)
	latencyMS := time.Since(start).Milliseconds()

	if err != nil {
		msg := "无法访问该地址：" + err.Error()
		if isTimeoutErr(err) {
			msg = "连接超时，请检查 Base URL 是否正确"
		}
		c.JSON(http.StatusOK, gin.H{
			"ok":         false,
			"message":    msg,
			"latency_ms": int64(0),
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		c.JSON(http.StatusOK, gin.H{
			"ok":         false,
			"message":    "认证失败，请检查 API Token",
			"latency_ms": latencyMS,
		})
		return
	}

	ok := resp.StatusCode >= 200 && resp.StatusCode < 300
	msg := fmt.Sprintf("连接成功 (HTTP %d)", resp.StatusCode)
	if !ok {
		msg = fmt.Sprintf("服务返回异常状态码 (HTTP %d)", resp.StatusCode)
	}
	c.JSON(http.StatusOK, gin.H{
		"ok":         ok,
		"message":    msg,
		"latency_ms": latencyMS,
	})
}

func isTimeoutErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "timed out")
}
