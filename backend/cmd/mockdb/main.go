package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/joho/godotenv"
)

func main() {
	action := flag.String("action", "ensure", "database action: ensure or recreate")
	timeout := flag.Duration("timeout", 10*time.Second, "operation timeout")
	flag.Parse()

	_ = godotenv.Load()

	dsn := getPostgresDSN()
	adminDSN, targetDB, err := buildAdminDSN(dsn)
	if err != nil {
		fatalf("invalid postgres configuration: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	db, err := sql.Open("pgx", adminDSN)
	if err != nil {
		fatalf("failed to open postgres admin connection: %v", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		fatalf("failed to ping postgres admin database: %v", err)
	}

	switch strings.ToLower(strings.TrimSpace(*action)) {
	case "ensure":
		if err := ensureDatabase(ctx, db, targetDB); err != nil {
			fatalf("failed to ensure database %q: %v", targetDB, err)
		}
	case "recreate":
		if err := recreateDatabase(ctx, db, targetDB); err != nil {
			fatalf("failed to recreate database %q: %v", targetDB, err)
		}
	default:
		fatalf("unsupported action %q, use ensure or recreate", *action)
	}

	fmt.Printf("[mockdb] database %q is ready (action=%s)\n", targetDB, *action)
}

func getPostgresDSN() string {
	if dsn := strings.TrimSpace(os.Getenv("DB_DSN")); dsn != "" {
		return dsn
	}

	host := getEnv("PG_HOST", "localhost")
	port := getEnvInt("PG_PORT", 5432)
	user := getEnv("PG_USER", "postgres")
	password := os.Getenv("PG_PASSWORD")
	database := getEnv("PG_DATABASE", "echocenter")
	sslMode := getEnv("PG_SSLMODE", "disable")

	u := &url.URL{
		Scheme:   "postgres",
		Host:     net.JoinHostPort(host, strconv.Itoa(port)),
		Path:     "/" + database,
		RawQuery: "sslmode=" + url.QueryEscape(sslMode),
	}
	if password != "" {
		u.User = url.UserPassword(user, password)
	} else {
		u.User = url.User(user)
	}
	return u.String()
}

func buildAdminDSN(targetDSN string) (adminDSN, targetDB string, err error) {
	u, err := url.Parse(targetDSN)
	if err != nil {
		return "", "", err
	}

	targetDB = strings.TrimPrefix(strings.TrimSpace(u.Path), "/")
	if targetDB == "" {
		targetDB = "echocenter"
	}

	adminURL := *u
	adminURL.Path = "/postgres"
	return adminURL.String(), targetDB, nil
}

func ensureDatabase(ctx context.Context, db *sql.DB, database string) error {
	exists, err := databaseExists(ctx, db, database)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = db.ExecContext(ctx, "CREATE DATABASE "+quoteIdentifier(database))
	return err
}

func recreateDatabase(ctx context.Context, db *sql.DB, database string) error {
	if isSystemDatabase(database) {
		return fmt.Errorf("refuse to recreate system database %q", database)
	}

	_, err := db.ExecContext(ctx,
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
		database,
	)
	if err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, "DROP DATABASE IF EXISTS "+quoteIdentifier(database)); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, "CREATE DATABASE "+quoteIdentifier(database)); err != nil {
		return err
	}
	return nil
}

func databaseExists(ctx context.Context, db *sql.DB, database string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)", database).Scan(&exists)
	return exists, err
}

func isSystemDatabase(database string) bool {
	switch database {
	case "postgres", "template0", "template1":
		return true
	default:
		return false
	}
}

func quoteIdentifier(v string) string {
	return `"` + strings.ReplaceAll(v, `"`, `""`) + `"`
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[mockdb] "+format+"\n", args...)
	os.Exit(1)
}
