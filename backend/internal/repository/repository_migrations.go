package repository

import (
	"fmt"
	"log"

	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

// migrate creates database tables and indexes with a tracking table.
func (r *sqlRepository) migrate() error {
	// Create migrations table first.
	_, err := r.db.Exec(`CREATE TABLE IF NOT EXISTS migrations (
		name TEXT PRIMARY KEY,
		executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create migrations table", err)
	}

	migrations := r.getMigrations()

	for _, m := range migrations {
		var exists int
		err := r.queryRow("SELECT COUNT(*) FROM migrations WHERE name = ?", m.name).Scan(&exists)
		if err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to check migration status", err)
		}
		if exists > 0 {
			continue
		}

		log.Printf("[Migration] Executing: %s", m.name)

		tx, err := r.db.Begin()
		if err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to start migration transaction", err)
		}

		for _, stmt := range m.statements {
			if _, err := r.txExec(tx, stmt); err != nil {
				_ = tx.Rollback()
				return apperrors.Wrap(apperrors.ErrDatabase, fmt.Sprintf("failed to run migration: %s", m.name), err)
			}
		}

		if _, err := r.txExec(tx, "INSERT INTO migrations (name) VALUES (?)", m.name); err != nil {
			_ = tx.Rollback()
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to record migration", err)
		}

		if err := tx.Commit(); err != nil {
			return apperrors.Wrap(apperrors.ErrDatabase, "failed to commit migration transaction", err)
		}
	}

	return nil
}

func (r *sqlRepository) getMigrations() []schemaMigration {
	if r.driver == driverPostgres {
		return []schemaMigration{
			{
				name: "001_create_messages_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS messages (
						id BIGSERIAL PRIMARY KEY,
						agent_id TEXT NOT NULL,
						level TEXT NOT NULL,
						content TEXT NOT NULL,
						timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "002_create_users_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS users (
						id BIGSERIAL PRIMARY KEY,
						username TEXT NOT NULL UNIQUE,
						password_hash TEXT NOT NULL,
						api_token TEXT UNIQUE,
						role TEXT NOT NULL DEFAULT 'MEMBER',
						created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "003_create_chat_messages_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS chat_messages (
						id BIGSERIAL PRIMARY KEY,
						local_id TEXT UNIQUE,
						sender_id BIGINT NOT NULL REFERENCES users(id),
						receiver_id BIGINT NOT NULL REFERENCES users(id),
						type TEXT DEFAULT 'CHAT',
						content TEXT NOT NULL,
						timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
					)`,
				},
			},
			{
				name: "004_create_butler_authorizations_table",
				statements: []string{
					`CREATE TABLE IF NOT EXISTS butler_authorizations (
						id TEXT PRIMARY KEY,
						target_agent_id BIGINT NOT NULL REFERENCES users(id),
						proposed_command TEXT NOT NULL,
						reasoning TEXT NOT NULL,
						status TEXT NOT NULL DEFAULT 'PENDING',
						created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
						responded_at TIMESTAMPTZ
					)`,
				},
			},
			{
				name: "005_create_indexes",
				statements: []string{
					`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC)`,
					`CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC)`,
					`CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status)`,
				},
			},
		}
	}

	return []schemaMigration{
		{
			name: "001_create_messages_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS messages (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					agent_id TEXT NOT NULL,
					level TEXT NOT NULL,
					content TEXT NOT NULL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
			},
		},
		{
			name: "002_create_users_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					password_hash TEXT NOT NULL,
					api_token TEXT UNIQUE,
					role TEXT NOT NULL DEFAULT 'MEMBER',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
			},
		},
		{
			name: "003_create_chat_messages_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS chat_messages (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					local_id TEXT UNIQUE,
					sender_id INTEGER NOT NULL,
					receiver_id INTEGER NOT NULL,
					type TEXT DEFAULT 'CHAT',
					content TEXT NOT NULL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY(sender_id) REFERENCES users(id),
					FOREIGN KEY(receiver_id) REFERENCES users(id)
				)`,
			},
		},
		{
			name: "004_create_butler_authorizations_table",
			statements: []string{
				`CREATE TABLE IF NOT EXISTS butler_authorizations (
					id TEXT PRIMARY KEY,
					target_agent_id INTEGER NOT NULL,
					proposed_command TEXT NOT NULL,
					reasoning TEXT NOT NULL,
					status TEXT NOT NULL DEFAULT 'PENDING',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					responded_at DATETIME,
					FOREIGN KEY(target_agent_id) REFERENCES users(id)
				)`,
			},
		},
		{
			name: "005_create_indexes",
			statements: []string{
				`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp DESC, id DESC)`,
				`CREATE INDEX IF NOT EXISTS idx_chat_pair_time ON chat_messages (sender_id, receiver_id, timestamp DESC)`,
				`CREATE INDEX IF NOT EXISTS idx_butler_status ON butler_authorizations (status)`,
			},
		},
	}
}
