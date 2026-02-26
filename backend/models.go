package main

import "time"

type Message struct {
	ID        int       `json:"id" db:"id"`
	AgentID   string    `json:"agent_id" db:"agent_id" binding:"required"`
	Level     string    `json:"level" db:"level" binding:"required"`
	Content   string    `json:"content" db:"content" binding:"required"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}
