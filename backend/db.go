package main

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

var db *sql.DB

func InitDB() {
	InitDBPath("./echocenter.db")
}

func InitDBPath(path string) {
	var err error
	db, err = sql.Open("sqlite", path)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	createTableSQL := `CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id TEXT NOT NULL,
		level TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatalf("Failed to create table: %v", err)
	}

	createIndexSQL := `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC);`
	_, err = db.Exec(createIndexSQL)
	if err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

	log.Println("Database initialized and table created at", path)
}

func CreateMessage(m Message) (int64, error) {
	query := `INSERT INTO messages (agent_id, level, content) VALUES (?, ?, ?)`
	res, err := db.Exec(query, m.AgentID, m.Level, m.Content)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func GetLatestMessages(limit int) ([]Message, error) {
	query := `SELECT id, agent_id, level, content, timestamp FROM messages ORDER BY timestamp DESC, id DESC LIMIT ?`
	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var m Message
		err := rows.Scan(&m.ID, &m.AgentID, &m.Level, &m.Content, &m.Timestamp)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}
