package database

import (
	"database/sql"
	"encoding/json"
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

	// Create messages table (Status Logs)
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

	// Create chat_messages table (T001)
	createChatTableSQL := `CREATE TABLE IF NOT EXISTS chat_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sender_id INTEGER NOT NULL,
		receiver_id INTEGER NOT NULL,
		content TEXT NOT NULL,
		timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(sender_id) REFERENCES users(id),
		FOREIGN KEY(receiver_id) REFERENCES users(id)
	);`
	_, err = db.Exec(createChatTableSQL)
	if err != nil {
		log.Fatalf("Failed to create chat_messages table: %v", err)
	}

	// Create butler_authorizations table (T004)
	createButlerTableSQL := `CREATE TABLE IF NOT EXISTS butler_authorizations (
		id TEXT PRIMARY KEY,
		target_agent_id INTEGER NOT NULL,
		proposed_command TEXT NOT NULL,
		reasoning TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'PENDING',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		responded_at DATETIME,
		FOREIGN KEY(target_agent_id) REFERENCES users(id)
	);`
	_, err = db.Exec(createButlerTableSQL)
	if err != nil {
		log.Fatalf("Failed to create butler_authorizations table: %v", err)
	}

	// Indexes for performance
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC);`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC);`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status);`)

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

func GetLatestMessages(agentID, level, query string, offset, limit int) ([]models.Message, error) {
	sqlQuery := `SELECT id, agent_id, level, content, timestamp FROM messages WHERE 1=1`
	var args []interface{}

	if agentID != "" {
		sqlQuery += ` AND agent_id = ?`
		args = append(args, agentID)
	}
	if level != "" {
		sqlQuery += ` AND level = ?`
		args = append(args, level)
	}
	if query != "" {
		sqlQuery += ` AND LOWER(content) LIKE LOWER(?)`
		args = append(args, "%"+query+"%")
	}

	sqlQuery += ` ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := db.Query(sqlQuery, args...)
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

// SaveAuthorization records a new Butler action request (T005)
func SaveAuthorization(actionID string, butlerID, targetID int, command, reasoning string) error {
	query := `INSERT INTO butler_authorizations (id, target_agent_id, proposed_command, reasoning) VALUES (?, ?, ?, ?)`
	_, err := db.Exec(query, actionID, targetID, command, reasoning)
	if err != nil {
		return err
	}

	// Also save to chat_messages so it persists in history
	payloadObj := map[string]interface{}{
		"action_id":         actionID,
		"target_agent_id":   targetID,
		"target_agent_name": "Target Agent", // placeholder
		"command":           command,
		"reason":            reasoning,
		"status":            "PENDING",
	}
	payloadJSON, _ := json.Marshal(payloadObj)
	
	// Admin ID is 1
	return SaveChatMessage(butlerID, 1, string(payloadJSON))
}

// UpdateAuthorizationStatus updates the status of a Butler request (T005)
func UpdateAuthorizationStatus(id string, status string) error {
	query := `UPDATE butler_authorizations SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, status, id)
	return err
}

// GetAuthorization retrieves a single request by ID
func GetAuthorization(id string) (*models.ButlerAuthorization, error) {
	var auth models.ButlerAuthorization
	query := `SELECT id, target_agent_id, proposed_command, reasoning, status, created_at FROM butler_authorizations WHERE id = ?`
	err := db.QueryRow(query, id).Scan(&auth.ID, &auth.TargetAgentID, &auth.ProposedCommand, &auth.Reasoning, &auth.Status, &auth.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &auth, nil
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

// SaveChatMessage persists a chat message (T002)
func SaveChatMessage(senderID, receiverID int, content string) error {
	if db == nil {
		return nil // Gracefully handle uninitialized DB (e.g. in unit tests)
	}
	query := `INSERT INTO chat_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`
	_, err := db.Exec(query, senderID, receiverID, content)
	return err
}

// GetChatHistory retrieves the latest 50 messages between two users (T003)
func GetChatHistory(user1ID, user2ID int, limit int) ([]models.ChatMessage, error) {
	query := `
		SELECT id, sender_id, receiver_id, content, timestamp 
		FROM chat_messages 
		WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		ORDER BY timestamp ASC 
		LIMIT ?
	`
	rows, err := db.Query(query, user1ID, user2ID, user2ID, user1ID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := []models.ChatMessage{}
	for rows.Next() {
		var m models.ChatMessage
		err := rows.Scan(&m.ID, &m.SenderID, &m.ReceiverID, &m.Payload, &m.Timestamp)
		if err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, nil
}
