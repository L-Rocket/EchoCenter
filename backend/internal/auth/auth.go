package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lea/echocenter/backend/internal/config"
	"github.com/lea/echocenter/backend/internal/repository"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	"golang.org/x/crypto/bcrypt"
)

// Service defines the authentication service interface
type Service interface {
	GenerateToken(userID int, role string) (string, error)
	ValidateToken(tokenString string) (*Claims, error)
	HashPassword(password string) (string, error)
	VerifyPassword(hashedPassword, password string) error
	AuthMiddleware() gin.HandlerFunc
	AdminOnlyMiddleware() gin.HandlerFunc
}

// Claims represents JWT claims
type Claims struct {
	UserID int    `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// service implements the Service interface
type service struct {
	config     *config.AuthConfig
	repository repository.Repository
}

// NewService creates a new authentication service
func NewService(cfg *config.AuthConfig, repo repository.Repository) Service {
	return &service{
		config:     cfg,
		repository: repo,
	}
}

// GenerateToken generates a new JWT token
func (s *service) GenerateToken(userID int, role string) (string, error) {
	expirationTime := time.Now().Add(s.config.TokenExpiration)
	claims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "echocenter",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to sign token", err)
	}

	return tokenString, nil
}

// ValidateToken validates a JWT token
func (s *service) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		if strings.Contains(err.Error(), "token is expired") {
			return nil, apperrors.ErrTokenExpired
		}
		return nil, apperrors.Wrap(apperrors.ErrTokenInvalid, "failed to parse token", err)
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, apperrors.ErrTokenInvalid
}

// HashPassword hashes a password using bcrypt
func (s *service) HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), s.config.BcryptCost)
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to hash password", err)
	}
	return string(hashedPassword), nil
}

// VerifyPassword verifies a password against a hash
func (s *service) VerifyPassword(hashedPassword, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
		return apperrors.ErrInvalidCredentials
	}
	return nil
}

// AuthMiddleware creates a middleware that validates JWT tokens
func (s *service) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			return
		}

		claims, err := s.ValidateToken(parts[1])
		if err != nil {
			if apperrors.Is(err, apperrors.ErrTokenExpired) {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token expired"})
				return
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

// AdminOnlyMiddleware creates a middleware that only allows admin users
func (s *service) AdminOnlyMiddleware() gin.HandlerFunc {
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

// GetUserIDFromContext extracts user ID from context
func GetUserIDFromContext(ctx context.Context) (int, bool) {
	userID, ok := ctx.Value("user_id").(int)
	return userID, ok
}

// GetUserRoleFromContext extracts user role from context
func GetUserRoleFromContext(ctx context.Context) (string, bool) {
	userRole, ok := ctx.Value("user_role").(string)
	return userRole, ok
}
