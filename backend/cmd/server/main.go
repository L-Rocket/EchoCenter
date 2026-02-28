package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/api/router"
	"github.com/lea/echocenter/backend/internal/api/handler"
	"github.com/lea/echocenter/backend/internal/auth"
	"github.com/lea/echocenter/backend/internal/butler"
	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/repository"
	"github.com/lea/echocenter/backend/internal/api/websocket"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize repository
	repo, err := repository.New(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize repository: %v", err)
	}
	defer repo.Close()

	// Initialize admin user
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	if err := repo.InitializeAdmin(ctx, cfg.Auth.InitialAdminUser, cfg.Auth.InitialAdminPassword, cfg.Auth.BcryptCost); err != nil {
		log.Printf("Failed to initialize admin: %v", err)
	}
	cancel()

	// Initialize authentication service
	authSvc := auth.NewService(&cfg.Auth, repo)

	// Initialize Butler Service first to get Butler ID
	butler.SetRepository(repo)
	agent, err := repo.GetUserByUsername(context.Background(), "Butler")

	// Initialize WebSocket hub with Butler and persistence handlers
	persistHandler := websocket.NewPersistingMessageHandler(repo)
	butlerUserHandler := butler.NewMessageHandler()
	var hub websocket.Hub

	if err == nil && agent != nil {
		butlerWSHandler := butler.NewWebSocketHandler(agent.ID)
		hub = websocket.NewHub(websocket.NewCompositeHandler(persistHandler, butlerUserHandler, butlerWSHandler))
		butler.InitButler(agent.ID, agent.Username, hub, repo)
		log.Printf("Butler service initialized for agent: %s (ID: %d)", agent.Username, agent.ID)
	} else {
		hub = websocket.NewHub(websocket.NewCompositeHandler(persistHandler, butlerUserHandler))
		log.Println("WARNING: 'Butler' not found in database. Run seed script to create Butler.")
	}

	// Create root context for graceful shutdown
	rootCtx, rootCancel := context.WithCancel(context.Background())
	defer rootCancel()

	// Start WebSocket hub
	go hub.Run(rootCtx)

	// Initialize handlers
	h := handler.NewHandler(repo, authSvc, hub)

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS configuration
	corsConfig := cors.Config{
		AllowOrigins:     cfg.CORS.AllowedOrigins,
		AllowMethods:     cfg.CORS.AllowedMethods,
		AllowHeaders:     cfg.CORS.AllowedHeaders,
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           time.Duration(cfg.CORS.MaxAge) * time.Second,
	}
	r.Use(cors.New(corsConfig))

	// Setup routes
	router.Setup(r, h, authSvc)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler:      r,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	// Cancel root context to stop all background goroutines
	rootCancel()

	log.Println("Server exited")
}
