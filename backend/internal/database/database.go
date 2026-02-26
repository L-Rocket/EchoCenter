package database

import (
	"database/sql"
	"log"
	"os"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/bcrypt"
	"github.com/joho/godotenv"
	"github.com/lea/echocenter/backend/internal/models"
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
		api_token TEXT UNIQUE,
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

func CloseDB() {
	if db != nil {
		db.Close()
	}
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

func CreateMessage(m models.Message) (int64, error) {
	query := `INSERT INTO messages (agent_id, level, content) VALUES (?, ?, ?)`
	res, err := db.Exec(query, m.AgentID, m.Level, m.Content)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func GetLatestMessages(limit int) ([]models.Message, error) {
	query := `SELECT id, agent_id, level, content, timestamp FROM messages ORDER BY timestamp DESC, id DESC LIMIT ?`
	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []models.Message{}
	for rows.Next() {
		var m models.Message
		err := rows.Scan(&m.ID, &m.AgentID, &m.Level, &m.Content, &m.Timestamp)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}

func GetUserByUsername(username string) (*models.User, error) {
	var u models.User
	var apiToken sql.NullString
	query := "SELECT id, username, password_hash, api_token, role, created_at FROM users WHERE username = ?"
	err := db.QueryRow(query, username).Scan(&u.ID, &u.Username, &u.PasswordHash, &apiToken, &u.Role, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if apiToken.Valid {
		u.ApiToken = apiToken.String
	}
	return &u, nil
}

func GetAgentByToken(token string) (*models.User, error) {
	var u models.User
	query := "SELECT id, username, role, created_at FROM users WHERE api_token = ? AND role = 'AGENT'"
	err := db.QueryRow(query, token).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	u.ApiToken = token
	return &u, nil
}

func CreateAgent(username, token string) error {
	_, err := db.Exec("INSERT INTO users (username, password_hash, api_token, role) VALUES (?, ?, ?, ?)", username, "AGENT_TOKEN_ONLY", token, "AGENT")
	return err
}

func GetAgents() ([]models.User, error) {
	query := "SELECT id, username, role, created_at FROM users WHERE role = 'AGENT'"
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	agents := []models.User{}
	for rows.Next() {
		var u models.User
		err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
		if err != nil {
			return nil, err
		}
		agents = append(agents, u)
	}
	return agents, nil
}

func CreateUser(username, password, role string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = db.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", username, string(hashedPassword), role)
	return err
}
