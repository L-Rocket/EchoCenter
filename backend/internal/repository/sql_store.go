package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/lea/echocenter/backend/internal/config"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
	_ "modernc.org/sqlite"
)

const (
	driverPostgres = "postgres"
	driverSQLite   = "sqlite"
)

type schemaMigration struct {
	name       string
	statements []string
}

// sqlRepository implements Repository with pluggable SQL drivers.
type sqlRepository struct {
	db     *sql.DB
	driver string
}

var (
	_ Repository            = (*sqlRepository)(nil)
	_ MessageRepository     = (*sqlRepository)(nil)
	_ UserRepository        = (*sqlRepository)(nil)
	_ ChatRepository        = (*sqlRepository)(nil)
	_ ButlerRepository      = (*sqlRepository)(nil)
	_ IntegrationRepository = (*sqlRepository)(nil)
	_ BootstrapRepository   = (*sqlRepository)(nil)
	_ MaintenanceRepository = (*sqlRepository)(nil)
)

// New creates a new repository instance.
func New(cfg *config.DatabaseConfig) (Repository, error) {
	driver := strings.ToLower(strings.TrimSpace(cfg.Driver))
	if driver == "" {
		driver = driverPostgres
	}

	var (
		db  *sql.DB
		err error
	)

	switch driver {
	case driverPostgres, "postgresql":
		driver = driverPostgres
		db, err = sql.Open("pgx", cfg.DSN)
		if err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to open postgres database", err)
		}
	case driverSQLite:
		// Ensure the directory for the database exists.
		dbDir := filepath.Dir(cfg.Path)
		if err := os.MkdirAll(dbDir, 0o755); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrInternal, "failed to create database directory", err)
		}

		// Add busy timeout and journal mode parameters to avoid lock contention errors.
		dsn := cfg.Path + "?_busy_timeout=5000&_journal_mode=WAL"
		db, err = sql.Open("sqlite", dsn)
		if err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to open database", err)
		}
	default:
		return nil, apperrors.New(apperrors.ErrInternal, fmt.Sprintf("unsupported DB_DRIVER: %s", cfg.Driver))
	}

	// Configure connection pool.
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	if err := db.Ping(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to ping database", err)
	}

	repo := &sqlRepository{db: db, driver: driver}
	if err := repo.migrate(); err != nil {
		return nil, err
	}

	return repo, nil
}

func (r *sqlRepository) rebind(query string) string {
	if r.driver != driverPostgres {
		return query
	}

	var b strings.Builder
	b.Grow(len(query) + 10)

	index := 1
	for i := 0; i < len(query); i++ {
		if query[i] == '?' {
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(index))
			index++
			continue
		}
		b.WriteByte(query[i])
	}
	return b.String()
}

func (r *sqlRepository) execContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	return r.db.ExecContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error) {
	return r.db.QueryContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryRowContext(ctx context.Context, query string, args ...any) *sql.Row {
	return r.db.QueryRowContext(ctx, r.rebind(query), args...)
}

func (r *sqlRepository) queryRow(query string, args ...any) *sql.Row {
	return r.db.QueryRow(r.rebind(query), args...)
}

func (r *sqlRepository) txExec(tx *sql.Tx, query string, args ...any) (sql.Result, error) {
	return tx.Exec(r.rebind(query), args...)
}

func (r *sqlRepository) txInsertAndReturnID(tx *sql.Tx, baseQuery string, args ...any) (int64, error) {
	if r.driver == driverPostgres {
		var id int64
		err := tx.QueryRow(r.rebind(baseQuery+" RETURNING id"), args...).Scan(&id)
		if err != nil {
			return 0, err
		}
		return id, nil
	}

	result, err := tx.Exec(r.rebind(baseQuery), args...)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *sqlRepository) insertAndReturnID(ctx context.Context, baseQuery string, args ...any) (int64, error) {
	if r.driver == driverPostgres {
		var id int64
		err := r.queryRowContext(ctx, baseQuery+" RETURNING id", args...).Scan(&id)
		if err != nil {
			return 0, err
		}
		return id, nil
	}

	result, err := r.execContext(ctx, baseQuery, args...)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

// Close closes the database connection.
func (r *sqlRepository) Close() error {
	if r.db != nil {
		return r.db.Close()
	}
	return nil
}

// isUniqueConstraintError checks if an error is a unique constraint violation.
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return true
	}

	// Embedded SQL unique constraint errors contain "unique constraint failed".
	return strings.Contains(strings.ToLower(err.Error()), "unique constraint failed")
}
