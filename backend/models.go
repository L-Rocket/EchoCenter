package main

import "time"

type Message struct {
	ID        int       `json:"id" db:"id"`
	AgentID   string    `json:"agent_id" db:"agent_id" binding:"required"`
	Level     string    `json:"level" db:"level" binding:"required"`
	Content   string    `json:"content" db:"content" binding:"required"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}

type User struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username" binding:"required"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose hash in JSON
	Role         string    `json:"role" db:"role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
