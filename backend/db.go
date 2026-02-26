package main

import (
	"database/sql"
	"log"
	"os"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
	"github.com/joho/godotenv"
)

var db *sql.DB

func InitDB() {
	// Load .env file (T009 dependency)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	InitDBPath("./echocenter.db")
}

func InitDBPath(path string) {
	var err error
	db, err = sql.Open("sqlite", path)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Create messages table
	createMessagesTableSQL := `CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		agent_id TEXT NOT NULL,
		level TEXT NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	_, err = db.Exec(createMessagesTableSQL)
	if err != nil {
		log.Fatalf("Failed to create messages table: %v", err)
	}

	// Create users table
	createUsersTableSQL := `CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'MEMBER',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`
	_, err = db.Exec(createUsersTableSQL)
	if err != nil {
		log.Fatalf("Failed to create users table: %v", err)
	}

	// Index for performance
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC);`)

	log.Println("Database initialized and tables verified at", path)

	// Admin initialization
	InitializeAdmin()
}

func InitializeAdmin() {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		log.Printf("Failed to check user count: %v", err)
		return
	}

	if count == 0 {
		adminUser := os.Getenv("INITIAL_ADMIN_USER")
		adminPass := os.Getenv("INITIAL_ADMIN_PASS")

		if adminUser == "" || adminPass == "" {
			log.Println("WARNING: INITIAL_ADMIN_USER or INITIAL_ADMIN_PASS not set. Skipping admin auto-init.")
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPass), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash admin password: %v", err)
		}

		_, err = db.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", adminUser, string(hashedPassword), "ADMIN")
		if err != nil {
			log.Fatalf("Failed to initialize admin user: %v", err)
		}
		log.Printf("Admin user '%s' initialized successfully.", adminUser)
	}
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

func GetUserByUsername(username string) (*User, error) {
	var u User
	query := "SELECT id, username, password_hash, role, created_at FROM users WHERE username = ?"
	err := db.QueryRow(query, username).Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func CreateUser(username, password, role string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = db.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", username, string(hashedPassword), role)
	return err
}
