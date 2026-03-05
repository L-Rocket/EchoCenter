package models

import "time"

type Message struct {
	ID        int       `json:"id" db:"id"`
	AgentID   string    `json:"agent_id" db:"agent_id" binding:"required"`
	Level     string    `json:"level" db:"level" binding:"required"`
	Content   string    `json:"content" db:"content" binding:"required"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}

type User struct {
	ID             int        `json:"id" db:"id"`
	Username       string     `json:"username" db:"username" binding:"required"`
	PasswordHash   string     `json:"-" db:"password_hash"` // Never expose hash in JSON
	APIToken       string     `json:"api_token,omitempty" db:"api_token"`
	Role           string     `json:"role" db:"role"`
	ActorType      string     `json:"actor_type" db:"actor_type"`
	TokenHint      string     `json:"token_hint,omitempty"`
	TokenUpdatedAt *time.Time `json:"token_updated_at,omitempty"`
	Status         string     `json:"status,omitempty"`
	Online         bool       `json:"online,omitempty"`
	LastSeenAt     *time.Time `json:"last_seen_at,omitempty"`
	LastReport     string     `json:"last_report,omitempty"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type ChatMessage struct {
	ID         int       `json:"id" db:"id"`
	LocalID    string    `json:"local_id" db:"local_id"`
	SenderID   int       `json:"sender_id" db:"sender_id"`
	ReceiverID int       `json:"receiver_id" db:"receiver_id"`
	Type       string    `json:"type" db:"type"` // CHAT, AUTH_REQUEST, AUTH_RESPONSE
	Payload    string    `json:"payload" db:"content"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
}

type ButlerAuthorization struct {
	ID              string     `json:"id" db:"id"`
	TargetAgentID   int        `json:"target_agent_id" db:"target_agent_id"`
	ProposedCommand string     `json:"proposed_command" db:"proposed_command"`
	Reasoning       string     `json:"reasoning" db:"reasoning"`
	Status          string     `json:"status" db:"status"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	RespondedAt     *time.Time `json:"responded_at,omitempty" db:"responded_at"`
}
