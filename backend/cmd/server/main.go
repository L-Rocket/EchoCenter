package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/database"
	"github.com/lea/echocenter/backend/internal/handlers"
	"github.com/lea/echocenter/backend/internal/websocket"
)

func main() {
	// Initialize Database and Load Env
	database.InitDB()

	// Initialize WebSocket Hub
	hub := websocket.NewHub()
	go hub.Run()
	handlers.SetHub(hub)

	// Gin configuration
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	// Public routes
	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "pong"})
		})
		api.POST("/auth/login", handlers.Login)
		
		// WebSocket endpoint (T013)
		api.GET("/ws", handlers.HandleWs)
	}

	// Protected routes
	protected := api.Group("/")
	protected.Use(auth.AuthMiddleware())
	{
		protected.GET("/messages", handlers.GetMessages)
		protected.POST("/messages", handlers.IngestMessage)

		// User Management (Admin only)
		admin := protected.Group("/users")
		admin.Use(auth.AdminOnlyMiddleware())
		{
			admin.POST("", handlers.HandleCreateUser)
			admin.POST("/agents", handlers.HandleRegisterAgent)
		}
		
		// All authenticated users can see agents and history
		protected.GET("/users/agents", handlers.HandleGetAgents)
		protected.GET("/chat/history/:peer_id", handlers.HandleGetChatHistory)
	}

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
