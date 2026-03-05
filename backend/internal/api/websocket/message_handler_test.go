package websocket

import (
	"testing"

	"github.com/lea/echocenter/backend/internal/models"
)

func TestIsHumanActor(t *testing.T) {
	tests := []struct {
		name string
		user *models.User
		want bool
	}{
		{
			name: "explicit human actor type",
			user: &models.User{Role: "AGENT", ActorType: "HUMAN"},
			want: true,
		},
		{
			name: "explicit system actor type",
			user: &models.User{Role: "ADMIN", ActorType: "SYSTEM"},
			want: false,
		},
		{
			name: "fallback human role",
			user: &models.User{Role: "ADMIN", ActorType: ""},
			want: true,
		},
		{
			name: "fallback system role",
			user: &models.User{Role: "BUTLER", ActorType: ""},
			want: false,
		},
		{
			name: "nil user",
			user: nil,
			want: false,
		},
	}

	for _, tt := range tests {
		got := isHumanActor(tt.user)
		if got != tt.want {
			t.Fatalf("%s: got %v, want %v", tt.name, got, tt.want)
		}
	}
}

func TestIsSystemRole(t *testing.T) {
	if !isSystemRole("agent") {
		t.Fatalf("expected AGENT to be system role")
	}
	if !isSystemRole("BUTLER") {
		t.Fatalf("expected BUTLER to be system role")
	}
	if isSystemRole("ADMIN") {
		t.Fatalf("expected ADMIN not to be system role")
	}
}
