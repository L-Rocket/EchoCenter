package handler

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/api/websocket"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/ops"
	"github.com/lea/echocenter/backend/internal/repository"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

type Handler struct {
	repo                 repository.Repository
	authSvc              auth.Service
	hub                  websocket.Hub
	appEnv               string
	initialAdminUser     string
	initialAdminPassword string
	bcryptCost           int
}

func NewHandler(repo repository.Repository, authSvc auth.Service, hub websocket.Hub, cfg *config.Config) *Handler {
	appEnv := "development"
	initialAdminUser := ""
	initialAdminPassword := ""
	bcryptCost := 12

	if cfg != nil {
		appEnv = strings.ToLower(strings.TrimSpace(cfg.Server.Env))
		initialAdminUser = cfg.Auth.InitialAdminUser
		initialAdminPassword = cfg.Auth.InitialAdminPassword
		bcryptCost = cfg.Auth.BcryptCost
	}

	return &Handler{
		repo:                 repo,
		authSvc:              authSvc,
		hub:                  hub,
		appEnv:               appEnv,
		initialAdminUser:     initialAdminUser,
		initialAdminPassword: initialAdminPassword,
		bcryptCost:           bcryptCost,
	}
}

func (h *Handler) respondWithError(c *gin.Context, defaultStatusCode int, err error) {
	statusCode := defaultStatusCode
	message := err.Error()

	var appErr *apperrors.AppError
	if apperrors.As(err, &appErr) {
		message = appErr.Message
		switch {
		case apperrors.Is(appErr, apperrors.ErrNotFound):
			statusCode = http.StatusNotFound
		case apperrors.Is(appErr, apperrors.ErrInvalidInput), apperrors.Is(appErr, apperrors.ErrValidation):
			statusCode = http.StatusBadRequest
		case apperrors.Is(appErr, apperrors.ErrUnauthorized), apperrors.Is(appErr, apperrors.ErrInvalidCredentials):
			statusCode = http.StatusUnauthorized
		case apperrors.Is(appErr, apperrors.ErrForbidden):
			statusCode = http.StatusForbidden
		case apperrors.Is(appErr, apperrors.ErrConflict):
			statusCode = http.StatusConflict
		case apperrors.Is(appErr, apperrors.ErrInternal), apperrors.Is(appErr, apperrors.ErrDatabase):
			statusCode = http.StatusInternalServerError
			message = "Internal server error" // Hide database details
		}
	} else if statusCode == http.StatusInternalServerError {
		message = "Internal server error"
	}

	// Log the actual error for debugging
	if statusCode >= 500 {
		log.Printf("[ERROR] %d: %v", statusCode, err)
	}

	c.JSON(statusCode, gin.H{"error": message})
}
func (h *Handler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	user, err := h.repo.GetUserByUsername(c.Request.Context(), req.Username)
	if err != nil {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrInvalidCredentials)
		return
	}

	if err := h.authSvc.VerifyPassword(user.PasswordHash, req.Password); err != nil {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrInvalidCredentials)
		return
	}

	token, err := h.authSvc.GenerateToken(user.ID, user.Role)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, models.LoginResponse{Token: token, User: *user})
}

func (h *Handler) GetMessages(c *gin.Context) {
	offset := 0
	limit := 50

	if v := strings.TrimSpace(c.Query("offset")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid offset"))
			return
		}
		offset = parsed
	}

	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed <= 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid limit"))
			return
		}
		if parsed > 200 {
			parsed = 200
		}
		limit = parsed
	}

	filter := repository.MessageFilter{
		AgentID: strings.TrimSpace(c.Query("agent_id")),
		Level:   strings.TrimSpace(c.Query("level")),
		Query:   strings.TrimSpace(c.Query("q")),
		Offset:  offset,
		Limit:   limit,
	}

	messages, err := h.repo.GetMessages(c.Request.Context(), filter)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) IngestMessage(c *gin.Context) {
	var msg models.Message
	if err := c.ShouldBindJSON(&msg); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	if err := h.repo.CreateMessage(c.Request.Context(), &msg); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *Handler) GetAgents(c *gin.Context) {
	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	exposeToken := requesterIsAdmin(c)

	excludedRoles := make(map[string]struct{})
	for _, raw := range strings.Split(c.Query("exclude_role"), ",") {
		role := strings.ToUpper(strings.TrimSpace(raw))
		if role != "" {
			excludedRoles[role] = struct{}{}
		}
	}

	query := strings.ToLower(strings.TrimSpace(c.Query("q")))

	page := 1
	pageSet := false
	if v := strings.TrimSpace(c.Query("page")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed <= 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid page"))
			return
		}
		page = parsed
		pageSet = true
	}

	limit := 0
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed <= 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid limit"))
			return
		}
		if parsed > 200 {
			parsed = 200
		}
		limit = parsed
	}

	filtered := make([]models.User, 0, len(agents))
	for _, agent := range agents {
		role := strings.ToUpper(strings.TrimSpace(agent.Role))
		if _, excluded := excludedRoles[role]; excluded {
			continue
		}
		if query != "" {
			usernameMatch := strings.Contains(strings.ToLower(agent.Username), query)
			roleMatch := strings.Contains(strings.ToLower(agent.Role), query)
			if !usernameMatch && !roleMatch {
				continue
			}
		}
		secured := h.withPresence(agent)
		if !exposeToken {
			secured = secureUserToken(secured)
		}
		filtered = append(filtered, secured)
	}

	c.Header("X-Total-Count", strconv.Itoa(len(filtered)))
	if limit == 0 && !pageSet {
		c.JSON(http.StatusOK, filtered)
		return
	}
	if limit == 0 {
		limit = 50
	}
	start := (page - 1) * limit
	if start >= len(filtered) {
		c.JSON(http.StatusOK, []models.User{})
		return
	}
	end := start + limit
	if end > len(filtered) {
		end = len(filtered)
	}
	c.JSON(http.StatusOK, filtered[start:end])
}

func (h *Handler) GetButler(c *gin.Context) {
	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	exposeToken := requesterIsAdmin(c)

	for _, user := range agents {
		if strings.EqualFold(user.Role, "BUTLER") {
			secured := h.withPresence(user)
			if !exposeToken {
				secured = secureUserToken(secured)
			}
			c.JSON(http.StatusOK, secured)
			return
		}
	}

	h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "butler not found"))
}

func (h *Handler) GetAgentStatuses(c *gin.Context) {
	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	statuses := make([]models.User, 0, len(agents))
	for _, user := range agents {
		if !strings.EqualFold(user.Role, "AGENT") {
			continue
		}
		presence := h.withPresence(user)
		statuses = append(statuses, models.User{
			ID:         presence.ID,
			Username:   presence.Username,
			Role:       presence.Role,
			Status:     presence.Status,
			Online:     presence.Online,
			LastSeenAt: presence.LastSeenAt,
			LastReport: presence.LastReport,
		})
	}

	c.JSON(http.StatusOK, statuses)
}

func (h *Handler) GetChatHistory(c *gin.Context) {
	peerIDStr := c.Param("peer_id")
	peerID, err := strconv.Atoi(peerIDStr)
	if err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid peer_id", err))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrUnauthorized)
		return
	}

	messages, err := h.repo.GetChatHistory(c.Request.Context(), userID.(int), peerID, 100)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) GetButlerAgentConversation(c *gin.Context) {
	agentIDStr := c.Param("agent_id")
	agentID, err := strconv.Atoi(agentIDStr)
	if err != nil || agentID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid agent_id"))
		return
	}

	agents, err := h.repo.GetAgents(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	butlerID := 0
	for _, a := range agents {
		if strings.EqualFold(a.Role, "BUTLER") {
			butlerID = a.ID
			break
		}
	}
	if butlerID == 0 {
		h.respondWithError(c, http.StatusNotFound, apperrors.New(apperrors.ErrNotFound, "butler not found"))
		return
	}

	messages, err := h.repo.GetChatHistory(c.Request.Context(), butlerID, agentID, 200)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, messages)
}

func (h *Handler) AuthResponse(c *gin.Context) {
	var req struct {
		ActionID string `json:"action_id"`
		Approved bool   `json:"approved"`
		StreamID string `json:"stream_id"`
		SenderID int    `json:"sender_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		h.respondWithError(c, http.StatusUnauthorized, apperrors.ErrUnauthorized)
		return
	}

	log.Printf("[AuthResponse] Received request: action_id=%s, stream_id=%s, sender_id=%d, user_id=%v", req.ActionID, req.StreamID, req.SenderID, userID)

	streamID := req.StreamID
	if streamID == "" {
		streamID = req.ActionID
	}

	log.Printf("[AuthResponse] Using streamID: %s, executing command for user: %v", streamID, userID)

	butlerService := butler.GetButler()
	if butlerService != nil {
		butlerService.ExecutePendingCommand(c.Request.Context(), streamID, userID.(int), req.Approved)
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *Handler) CreateUser(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	if err := h.repo.CreateUser(c.Request.Context(), &user); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *Handler) RegisterAgent(c *gin.Context) {
	var req struct {
		Username    string `json:"username"`
		APIToken    string `json:"api_token"`
		AgentKind   string `json:"agent_kind"`
		RuntimeKind string `json:"runtime_kind"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	agent := models.User{
		Username:    strings.TrimSpace(req.Username),
		APIToken:    strings.TrimSpace(req.APIToken),
		Role:        "AGENT",
		AgentKind:   strings.TrimSpace(req.AgentKind),
		RuntimeKind: strings.TrimSpace(req.RuntimeKind),
		Description: strings.TrimSpace(req.Description),
	}
	if agent.Username == "" {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "username is required"))
		return
	}
	if agent.AgentKind == "" {
		agent.AgentKind = "generic"
	}
	if agent.RuntimeKind == "" {
		agent.RuntimeKind = "websocket"
	}
	if strings.EqualFold(agent.AgentKind, ops.ManagedAgentKind()) || strings.EqualFold(agent.RuntimeKind, ops.ManagedRuntimeKind()) {
		agent.AgentKind = ops.ManagedAgentKind()
		agent.RuntimeKind = ops.ManagedRuntimeKind()
	}
	if err := h.repo.CreateUser(c.Request.Context(), &agent); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, agent)
}

func (h *Handler) ListSSHKeys(c *gin.Context) {
	keys, err := h.repo.ListSSHKeys(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, keys)
}

func (h *Handler) GetOpsStatus(c *gin.Context) {
	executor := ops.GetExecutor()
	if executor == nil {
		c.JSON(http.StatusOK, gin.H{
			"enabled":            false,
			"worker_reachable":   false,
			"worker_mode":        "",
			"service_url":        "",
			"managed_agent_id":   0,
			"managed_agent_name": "",
			"node_count":         0,
			"ssh_key_count":      0,
		})
		return
	}

	status := executor.StatusSummary(c.Request.Context())
	c.JSON(http.StatusOK, status)
}

func (h *Handler) ListOpenHandsTasks(c *gin.Context) {
	executor := ops.GetExecutor()
	if executor == nil {
		c.JSON(http.StatusOK, []models.OpenHandsTaskRecord{})
		return
	}

	limit := 10
	if v := strings.TrimSpace(c.Query("limit")); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed <= 0 {
			h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid limit"))
			return
		}
		if parsed > 20 {
			parsed = 20
		}
		limit = parsed
	}

	c.JSON(http.StatusOK, executor.RecentTasks(limit))
}

func (h *Handler) CreateSSHKey(c *gin.Context) {
	var key models.SSHKey
	if err := c.ShouldBindJSON(&key); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}
	if err := h.repo.CreateSSHKey(c.Request.Context(), &key); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	key.PrivateKey = ""
	c.JSON(http.StatusCreated, key)
}

func (h *Handler) UpdateSSHKey(c *gin.Context) {
	keyID, err := strconv.Atoi(c.Param("id"))
	if err != nil || keyID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid ssh key id"))
		return
	}

	var key models.SSHKey
	if err := c.ShouldBindJSON(&key); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}
	key.ID = keyID

	if err := h.repo.UpdateSSHKey(c.Request.Context(), &key); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	key.PrivateKey = ""
	c.JSON(http.StatusOK, key)
}

func (h *Handler) DeleteSSHKey(c *gin.Context) {
	keyID, err := strconv.Atoi(c.Param("id"))
	if err != nil || keyID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid ssh key id"))
		return
	}
	if err := h.repo.DeleteSSHKey(c.Request.Context(), keyID); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) ListInfraNodes(c *gin.Context) {
	nodes, err := h.repo.ListInfraNodes(c.Request.Context())
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, nodes)
}

func (h *Handler) CreateInfraNode(c *gin.Context) {
	var node models.InfraNode
	if err := c.ShouldBindJSON(&node); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}
	if err := h.repo.CreateInfraNode(c.Request.Context(), &node); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusCreated, node)
}

func (h *Handler) UpdateInfraNode(c *gin.Context) {
	nodeID, err := strconv.Atoi(c.Param("id"))
	if err != nil || nodeID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid infra node id"))
		return
	}

	var node models.InfraNode
	if err := c.ShouldBindJSON(&node); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}
	node.ID = nodeID

	if err := h.repo.UpdateInfraNode(c.Request.Context(), &node); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, node)
}

func (h *Handler) DeleteInfraNode(c *gin.Context) {
	nodeID, err := strconv.Atoi(c.Param("id"))
	if err != nil || nodeID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid infra node id"))
		return
	}
	if err := h.repo.DeleteInfraNode(c.Request.Context(), nodeID); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *Handler) TestInfraNode(c *gin.Context) {
	nodeID, err := strconv.Atoi(c.Param("id"))
	if err != nil || nodeID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid infra node id"))
		return
	}

	executor := ops.GetExecutor()
	if executor == nil {
		h.respondWithError(c, http.StatusInternalServerError, apperrors.New(apperrors.ErrInternal, "OpenHands executor is not initialized"))
		return
	}

	result, err := executor.TestNodeConnectivity(c.Request.Context(), nodeID)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *Handler) TestAgentConnection(c *gin.Context) {
	var req struct {
		APIToken string `json:"api_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	token := strings.TrimSpace(req.APIToken)
	if token == "" {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "api_token is required"))
		return
	}

	agent, err := h.repo.GetAgentByToken(c.Request.Context(), token)
	if err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	if agent == nil {
		c.JSON(http.StatusOK, gin.H{
			"ok":      false,
			"message": "token is not registered to any agent",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":         true,
		"message":    "token accepted by backend",
		"agent_id":   agent.ID,
		"agent_name": agent.Username,
	})
}

func (h *Handler) UpdateAgentToken(c *gin.Context) {
	agentID, err := strconv.Atoi(c.Param("id"))
	if err != nil || agentID <= 0 {
		h.respondWithError(c, http.StatusBadRequest, apperrors.New(apperrors.ErrInvalidInput, "invalid agent id"))
		return
	}

	var req struct {
		APIToken string `json:"api_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondWithError(c, http.StatusBadRequest, apperrors.Wrap(apperrors.ErrInvalidInput, "invalid request body", err))
		return
	}

	if err := h.repo.UpdateAgentToken(c.Request.Context(), agentID, req.APIToken); err != nil {
		h.respondWithError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ok":       true,
		"message":  "agent token updated",
		"agent_id": agentID,
	})
}

func (h *Handler) withPresence(user models.User) models.User {
	if executor := ops.GetExecutor(); executor != nil && executor.IsManagedAgent(user) {
		online, report := executor.Status(user)
		user.Online = online
		if online {
			user.Status = "ONLINE"
			now := time.Now().UTC()
			user.LastSeenAt = &now
		} else {
			user.Status = "OFFLINE"
		}
		user.LastReport = report
		return user
	}
	if h.hub == nil {
		user.Status = "OFFLINE"
		user.Online = false
		user.LastReport = "websocket_disconnected"
		return user
	}
	_, online := h.hub.GetClient(user.ID)
	user.Online = online
	if online {
		user.Status = "ONLINE"
		now := time.Now().UTC()
		user.LastSeenAt = &now
		user.LastReport = "websocket_connected"
	} else {
		user.Status = "OFFLINE"
		user.LastReport = "websocket_disconnected"
	}
	return user
}

func secureUserToken(user models.User) models.User {
	token := strings.TrimSpace(user.APIToken)
	if token != "" {
		user.TokenHint = maskTokenHint(token)
	}
	user.APIToken = ""
	return user
}

func maskTokenHint(token string) string {
	if token == "" {
		return ""
	}
	if len(token) <= 8 {
		return "configured"
	}
	return token[:4] + strings.Repeat("*", len(token)-8) + token[len(token)-4:]
}

func requesterIsAdmin(c *gin.Context) bool {
	role, ok := c.Get("user_role")
	if !ok {
		return false
	}
	roleStr, ok := role.(string)
	if !ok {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(roleStr), "ADMIN")
}
