package auth

import (
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestPasswordHashing(t *testing.T) {
	password := "secure-pass-123"

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	// Verify success
	err = bcrypt.CompareHashAndPassword(hash, []byte(password))
	if err != nil {
		t.Errorf("Password should match hash: %v", err)
	}

	// Verify failure
	err = bcrypt.CompareHashAndPassword(hash, []byte("wrong-password"))
	if err == nil {
		t.Error("Password should NOT match hash")
	}
}
