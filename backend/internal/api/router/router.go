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

		// Chat
		protected.GET("/chat/history/:peer_id", h.GetChatHistory)
		protected.POST("/chat/auth/response", h.AuthResponse)

		// Admin routes
		admin := protected.Group("/users")
		admin.Use(middleware.AdminOnly(authSvc))
		{
			admin.POST("", h.CreateUser)
			admin.POST("/agents", h.RegisterAgent)
		}

		// Dev mock routes (admin + non-production only)
		dev := protected.Group("/dev/mock")
		dev.Use(middleware.AdminOnly(authSvc))
		{
			dev.POST("/reset", h.DevMockReset)
			dev.POST("/chat", h.DevMockInsertChat)
			dev.GET("/agent-token/:username", h.DevGetAgentToken)
		}
	}
}
