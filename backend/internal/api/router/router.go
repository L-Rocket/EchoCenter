package router

import (
	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/api/handler"
	"github.com/lea/echocenter/backend/internal/api/middleware"
	"github.com/lea/echocenter/backend/internal/auth"
)

// Setup configures all HTTP routes
func Setup(r *gin.Engine, h *handler.Handler, authSvc auth.Service) {
	// Public routes
	api := r.Group("/api")
	{
		api.GET("/ping", h.Ping)
		api.POST("/auth/login", h.Login)
		api.GET("/ws", h.HandleWS)
	}

	// Protected routes
	protected := api.Group("/")
	protected.Use(middleware.Auth(authSvc))
	{
		// Messages
		protected.GET("/messages", h.GetMessages)
		protected.POST("/messages", h.IngestMessage)

		// Agents
		protected.GET("/users/agents", h.GetAgents)
		protected.GET("/users/agents/status", h.GetAgentStatuses)
		protected.GET("/users/butler", h.GetButler)

		// Chat
		protected.GET("/chat/history/:peer_id", h.GetChatHistory)
		protected.GET("/chat/threads", h.ListConversationThreads)
		protected.POST("/chat/threads", h.CreateConversationThread)
		protected.PATCH("/chat/threads/:thread_id", h.UpdateConversationThread)
		protected.GET("/chat/threads/:thread_id/messages", h.GetConversationMessages)
		protected.GET("/chat/butler-agent/:agent_id", h.GetButlerAgentConversation)
		protected.POST("/chat/auth/response", h.AuthResponse)

		// Admin routes
		admin := protected.Group("/users")
		admin.Use(middleware.AdminOnly(authSvc))
		{
			admin.POST("", h.CreateUser)
			admin.POST("/agents", h.RegisterAgent)
			admin.POST("/agents/test-connection", h.TestAgentConnection)
			admin.PATCH("/agents/:id/token", h.UpdateAgentToken)
			admin.GET("/ops/status", h.GetOpsStatus)
			admin.GET("/ops/tasks", h.ListOpenHandsTasks)
			admin.GET("/ops/ssh-keys", h.ListSSHKeys)
			admin.POST("/ops/ssh-keys", h.CreateSSHKey)
			admin.PATCH("/ops/ssh-keys/:id", h.UpdateSSHKey)
			admin.DELETE("/ops/ssh-keys/:id", h.DeleteSSHKey)
			admin.GET("/ops/nodes", h.ListInfraNodes)
			admin.POST("/ops/nodes", h.CreateInfraNode)
			admin.PATCH("/ops/nodes/:id", h.UpdateInfraNode)
			admin.DELETE("/ops/nodes/:id", h.DeleteInfraNode)
			admin.POST("/ops/nodes/:id/test", h.TestInfraNode)
		}

		integrations := protected.Group("/integrations")
		integrations.Use(middleware.AdminOnly(authSvc))
		{
			integrations.GET("/feishu", h.GetFeishuConnector)
			integrations.POST("/feishu", h.CreateFeishuConnector)
			integrations.PATCH("/feishu/:id", h.UpdateFeishuConnector)
			integrations.POST("/feishu/:id/verify-callback", h.VerifyFeishuCallback)
			integrations.POST("/feishu/:id/test-message", h.SendFeishuTestMessage)
			integrations.PATCH("/feishu/:id/enable", h.SetFeishuConnectorEnabled)
			integrations.GET("/feishu/:id/logs", h.ListFeishuIntegrationLogs)
		}

		// Dev mock routes (admin + non-production only)
		dev := protected.Group("/dev/mock")
		dev.Use(middleware.AdminOnly(authSvc))
		{
			dev.POST("/reset", h.DevMockReset)
			dev.POST("/chat", h.DevMockInsertChat)
			dev.POST("/ops-task", h.DevMockSeedOpenHandsTask)
			dev.POST("/feishu-log", h.DevMockAppendFeishuLog)
			dev.GET("/agent-token/:username", h.DevGetAgentToken)
		}
	}
}
