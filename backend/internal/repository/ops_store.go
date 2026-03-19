package repository

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"io"
	"os"
	"strings"

	"github.com/lea/echocenter/backend/internal/models"
	apperrors "github.com/lea/echocenter/backend/pkg/errors"
)

func (r *sqlRepository) ListSSHKeys(ctx context.Context) ([]models.SSHKey, error) {
	rows, err := r.queryContext(ctx, `
		SELECT id, name, public_key, created_at, updated_at
		FROM ssh_keys
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query ssh keys", err)
	}
	defer rows.Close()

	var keys []models.SSHKey
	for rows.Next() {
		var item models.SSHKey
		if err := rows.Scan(&item.ID, &item.Name, &item.PublicKey, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan ssh key", err)
		}
		item.HasPrivateKey = true
		keys = append(keys, item)
	}
	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed iterating ssh keys", err)
	}
	return keys, nil
}

func (r *sqlRepository) CreateSSHKey(ctx context.Context, key *models.SSHKey) error {
	if key == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "ssh key is required")
	}
	key.Name = strings.TrimSpace(key.Name)
	key.PrivateKey = strings.TrimSpace(key.PrivateKey)
	key.PublicKey = strings.TrimSpace(key.PublicKey)
	if key.Name == "" || key.PrivateKey == "" {
		return apperrors.New(apperrors.ErrInvalidInput, "ssh key name and private key are required")
	}

	encrypted, err := encryptSecret(key.PrivateKey, sshKeyEncryptionSecret())
	if err != nil {
		return err
	}

	id, err := r.insertAndReturnID(ctx, `
		INSERT INTO ssh_keys (name, public_key, encrypted_private_key)
		VALUES (?, ?, ?)
	`, key.Name, key.PublicKey, encrypted)
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "ssh key name already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create ssh key", err)
	}

	key.ID = int(id)
	key.HasPrivateKey = true
	return nil
}

func (r *sqlRepository) DeleteSSHKey(ctx context.Context, id int) error {
	result, err := r.execContext(ctx, `DELETE FROM ssh_keys WHERE id = ?`, id)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to delete ssh key", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apperrors.New(apperrors.ErrNotFound, "ssh key not found")
	}
	return nil
}

func (r *sqlRepository) GetSSHKeyMaterial(ctx context.Context, id int) (*models.SSHKey, error) {
	var item models.SSHKey
	var encrypted string
	err := r.queryRowContext(ctx, `
		SELECT id, name, public_key, encrypted_private_key, created_at, updated_at
		FROM ssh_keys
		WHERE id = ?
	`, id).Scan(&item.ID, &item.Name, &item.PublicKey, &encrypted, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, apperrors.New(apperrors.ErrNotFound, "ssh key not found")
		}
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to load ssh key", err)
	}

	decrypted, decErr := decryptSecret(encrypted, sshKeyEncryptionSecret())
	if decErr != nil {
		return nil, decErr
	}
	item.PrivateKey = decrypted
	item.HasPrivateKey = true
	return &item, nil
}

func (r *sqlRepository) ListInfraNodes(ctx context.Context) ([]models.InfraNode, error) {
	rows, err := r.queryContext(ctx, `
		SELECT id, name, host, port, ssh_user, ssh_key_id, description, created_at, updated_at
		FROM infra_nodes
		ORDER BY id DESC
	`)
	if err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to query infra nodes", err)
	}
	defer rows.Close()

	var nodes []models.InfraNode
	for rows.Next() {
		var item models.InfraNode
		if err := rows.Scan(&item.ID, &item.Name, &item.Host, &item.Port, &item.SSHUser, &item.SSHKeyID, &item.Description, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed to scan infra node", err)
		}
		nodes = append(nodes, item)
	}
	if err := rows.Err(); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrDatabase, "failed iterating infra nodes", err)
	}
	return nodes, nil
}

func (r *sqlRepository) CreateInfraNode(ctx context.Context, node *models.InfraNode) error {
	if node == nil {
		return apperrors.New(apperrors.ErrInvalidInput, "infra node is required")
	}
	node.Name = strings.TrimSpace(node.Name)
	node.Host = strings.TrimSpace(node.Host)
	node.SSHUser = strings.TrimSpace(node.SSHUser)
	node.Description = strings.TrimSpace(node.Description)
	if node.Name == "" || node.Host == "" || node.SSHUser == "" || node.SSHKeyID <= 0 {
		return apperrors.New(apperrors.ErrInvalidInput, "name, host, ssh_user, and ssh_key_id are required")
	}
	if node.Port <= 0 {
		node.Port = 22
	}

	id, err := r.insertAndReturnID(ctx, `
		INSERT INTO infra_nodes (name, host, port, ssh_user, ssh_key_id, description)
		VALUES (?, ?, ?, ?, ?, ?)
	`, node.Name, node.Host, node.Port, node.SSHUser, node.SSHKeyID, node.Description)
	if err != nil {
		if isUniqueConstraintError(err) {
			return apperrors.Wrap(apperrors.ErrConflict, "infra node name already exists", err)
		}
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to create infra node", err)
	}

	node.ID = int(id)
	return nil
}

func (r *sqlRepository) DeleteInfraNode(ctx context.Context, id int) error {
	result, err := r.execContext(ctx, `DELETE FROM infra_nodes WHERE id = ?`, id)
	if err != nil {
		return apperrors.Wrap(apperrors.ErrDatabase, "failed to delete infra node", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return apperrors.New(apperrors.ErrNotFound, "infra node not found")
	}
	return nil
}

func sshKeyEncryptionSecret() string {
	if key := strings.TrimSpace(os.Getenv("OPENHANDS_SSH_KEY_ENCRYPTION_KEY")); key != "" {
		return key
	}
	return os.Getenv("JWT_SECRET")
}

func encryptSecret(plaintext, secret string) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", apperrors.New(apperrors.ErrInvalidInput, "OPENHANDS_SSH_KEY_ENCRYPTION_KEY or JWT_SECRET is required")
	}
	sum := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(sum[:])
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to initialize secret cipher", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to initialize secret gcm", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to generate encryption nonce", err)
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func decryptSecret(encoded, secret string) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", apperrors.New(apperrors.ErrInvalidInput, "OPENHANDS_SSH_KEY_ENCRYPTION_KEY or JWT_SECRET is required")
	}
	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to decode encrypted secret", err)
	}
	sum := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(sum[:])
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to initialize secret cipher", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to initialize secret gcm", err)
	}
	if len(raw) < gcm.NonceSize() {
		return "", apperrors.New(apperrors.ErrInternal, "encrypted secret payload is too short")
	}
	nonce, ciphertext := raw[:gcm.NonceSize()], raw[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", apperrors.Wrap(apperrors.ErrInternal, "failed to decrypt secret", err)
	}
	return string(plaintext), nil
}
