package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lea/echocenter/backend/internal/auth"
)

// Auth creates a middleware that validates JWT tokens
func Auth(authSvc auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		parts := splitAuthHeader(authHeader)
		if len(parts) != 2 || parts[0] != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			return
		}

		claims, err := authSvc.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// AdminOnly creates a middleware that only allows admin users
func AdminOnly(authSvc auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "user context not found"})
			return
		}

		if role != "ADMIN" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "admin access required"})
			return
		}

		c.Next()
	}
}

func splitAuthHeader(header string) []string {
	var parts []string
	var current string
	for i, ch := range header {
		if ch == ' ' && current != "" {
			parts = append(parts, current)
			current = ""
		} else {
			current += string(ch)
		}
		if i == len(header)-1 && current != "" {
			parts = append(parts, current)
		}
	}
	// Convert first part to lowercase for comparison
	if len(parts) > 0 {
		parts[0] = toLower(parts[0])
	}
	return parts
}

func toLower(s string) string {
	var result string
	for _, ch := range s {
		if ch >= 'A' && ch <= 'Z' {
			result += string(ch + 32)
		} else {
			result += string(ch)
		}
	}
	return result
}
