package repository

import (
	"context"

	"github.com/lea/echocenter/backend/pkg/errors"
	"golang.org/x/crypto/bcrypt"
)

// InitializeAdmin creates the initial admin user if no users exist
func (r *sqliteRepository) InitializeAdmin(ctx context.Context, username, password string, bcryptCost int) error {
	if username == "" || password == "" {
		return nil
	}

	var count int
	err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		return errors.Wrap(errors.ErrDatabase, "failed to check user count", err)
	}

	if count > 0 {
		return nil
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return errors.Wrap(errors.ErrInternal, "failed to hash password", err)
	}

	_, err = r.db.ExecContext(ctx,
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, string(hashedPassword), "ADMIN",
	)
	if err != nil {
		return errors.Wrap(errors.ErrDatabase, "failed to create admin user", err)
	}

	return nil
}
