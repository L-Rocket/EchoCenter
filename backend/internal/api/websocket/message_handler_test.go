package websocket

import (
	"context"
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

func TestShouldPersistChatPair(t *testing.T) {
	if !shouldPersistChatPair(
		&models.User{Role: "ADMIN", ActorType: "HUMAN"},
		&models.User{Role: "AGENT", ActorType: "SYSTEM"},
		"ADMIN",
	) {
		t.Fatalf("expected human-agent chat to persist")
	}

	if !shouldPersistChatPair(
		&models.User{Role: "BUTLER", ActorType: "SYSTEM"},
		&models.User{Role: "AGENT", ActorType: "SYSTEM"},
		"BUTLER",
	) {
		t.Fatalf("expected butler-agent chat to persist")
	}

	if shouldPersistChatPair(
		&models.User{Role: "AGENT", ActorType: "SYSTEM"},
		&models.User{Role: "AGENT", ActorType: "SYSTEM"},
		"AGENT",
	) {
		t.Fatalf("expected agent-agent chat not to persist")
	}
}

type testUserLookupRepo struct {
	users map[int]*models.User
}

func (r *testUserLookupRepo) GetUserByID(_ context.Context, id int) (*models.User, error) {
	return r.users[id], nil
}

func (r *testUserLookupRepo) GetUsers(_ context.Context) ([]models.User, error) {
	items := make([]models.User, 0, len(r.users))
	for _, u := range r.users {
		if u != nil {
			items = append(items, *u)
		}
	}
	return items, nil
}

func TestButlerAgentMonitorHandlerEmitsEvent(t *testing.T) {
	repo := &testUserLookupRepo{
		users: map[int]*models.User{
			1: {ID: 1, Username: "admin", Role: "ADMIN"},
			2: {ID: 2, Username: "Butler", Role: "BUTLER"},
			7: {ID: 7, Username: "Agent-7", Role: "AGENT"},
		},
	}

	handler := NewButlerAgentMonitorHandler(repo)
	var emitted []map[string]any
	handler.SetEmitter(func(v any) {
		event, ok := v.(map[string]any)
		if ok {
			emitted = append(emitted, event)
		}
	})

	handler.HandleMessage(context.Background(), &Message{
		Type:       MessageTypeChat,
		ID:         101,
		SenderID:   2,
		SenderName: "Butler",
		SenderRole: "BUTLER",
		TargetID:   7,
		Payload:    "run health check",
		Timestamp:  "2026-03-05T11:22:33Z",
	})

	if len(emitted) != 1 {
		t.Fatalf("expected 1 emitted event, got %d", len(emitted))
	}
	event := emitted[0]
	if event["type"] != string(MessageTypeButlerAgent) {
		t.Fatalf("unexpected event type: %v", event["type"])
	}
	if event["target_id"] != 1 {
		t.Fatalf("expected target_id=1(admin), got %v", event["target_id"])
	}

	payload, ok := event["payload"].(map[string]any)
	if !ok {
		t.Fatalf("expected payload map, got %T", event["payload"])
	}
	if payload["agent_id"] != 7 {
		t.Fatalf("expected agent_id=7, got %v", payload["agent_id"])
	}
	if payload["sender_role"] != "BUTLER" {
		t.Fatalf("unexpected sender_role: %v", payload["sender_role"])
	}
}

func TestButlerAgentMonitorHandlerSkipsNonButlerAgent(t *testing.T) {
	repo := &testUserLookupRepo{
		users: map[int]*models.User{
			1: {ID: 1, Username: "admin", Role: "ADMIN"},
			7: {ID: 7, Username: "Agent-7", Role: "AGENT"},
		},
	}

	handler := NewButlerAgentMonitorHandler(repo)
	called := false
	handler.SetEmitter(func(any) {
		called = true
	})

	handler.HandleMessage(context.Background(), &Message{
		Type:      MessageTypeChat,
		SenderID:  1,
		TargetID:  7,
		Payload:   "hello",
		Timestamp: "2026-03-05T11:22:33Z",
	})

	if called {
		t.Fatalf("expected no monitor event for admin-agent traffic")
	}
}

func TestButlerAgentMonitorHandlerSkipsWhenNoAdminRecipients(t *testing.T) {
	repo := &testUserLookupRepo{
		users: map[int]*models.User{
			2: {ID: 2, Username: "Butler", Role: "BUTLER"},
			7: {ID: 7, Username: "Agent-7", Role: "AGENT"},
		},
	}

	handler := NewButlerAgentMonitorHandler(repo)
	called := false
	handler.SetEmitter(func(any) {
		called = true
	})

	handler.HandleMessage(context.Background(), &Message{
		Type:      MessageTypeChat,
		SenderID:  2,
		TargetID:  7,
		Payload:   "run health check",
		Timestamp: "2026-03-05T11:22:33Z",
	})

	if called {
		t.Fatalf("expected no emitted event when no admin recipients")
	}
}

func TestShouldSkipRuntimeOnlyChat(t *testing.T) {
	if !shouldSkipRuntimeOnlyChat("[RUNTIME-QUESTION] summarize current queue depth") {
		t.Fatalf("expected runtime-only prefix to be skipped")
	}
	if shouldSkipRuntimeOnlyChat("normal user chat") {
		t.Fatalf("expected normal chat not to be skipped")
	}
	if shouldSkipRuntimeOnlyChat(map[string]any{"payload": "nope"}) {
		t.Fatalf("expected non-string payload not to be skipped")
	}
}
