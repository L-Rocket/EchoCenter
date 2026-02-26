package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestTokenGenerationAndValidation(t *testing.T) {
	userID := 1
	role := "ADMIN"

	token, err := GenerateToken(userID, role)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("Expected UserID %d, got %d", userID, claims.UserID)
	}

	if claims.Role != role {
		t.Errorf("Expected Role %s, got %s", role, claims.Role)
	}
}

func TestInvalidToken(t *testing.T) {
	_, err := ValidateToken("invalid.token.string")
	if err != ErrInvalidToken {
		t.Errorf("Expected ErrInvalidToken, got %v", err)
	}
}

// SC-004 Verification (T031) - Token Expiry
func TestExpiredToken(t *testing.T) {
	// Generate a token that expired 1 hour ago
	expirationTime := time.Now().Add(-1 * time.Hour)
	claims := &Claims{
		UserID: 1,
		Role:   "MEMBER",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, _ := token.SignedString(getSecret())

	_, err := ValidateToken(tokenString)
	if err != ErrExpiredToken {
		t.Errorf("Expected ErrExpiredToken, got %v", err)
	}
}
