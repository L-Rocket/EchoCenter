package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/auth"
)

func main() {
	// Initialize Database and Load Env
	InitDB()

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
		api.POST("/auth/login", Login)
	}

	// Protected routes (T015)
	protected := api.Group("/")
	protected.Use(auth.AuthMiddleware())
	{
		protected.GET("/messages", GetMessages)
		protected.POST("/messages", IngestMessage)

		// User Management (Admin only)
		admin := protected.Group("/users")
		admin.Use(auth.AdminOnlyMiddleware())
		{
			admin.POST("", HandleCreateUser)
		}
	}

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
