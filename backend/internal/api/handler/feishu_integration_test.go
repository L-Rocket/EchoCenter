package handler

import (
	"testing"
	"time"

	"github.com/lea/echocenter/backend/internal/models"
)

func TestVerifyFeishuToken(t *testing.T) {
	h := &Handler{}

	if h.verifyFeishuToken("anything", "") {
		t.Fatalf("expected token verification to fail when expected token is unset")
	}
	if !h.verifyFeishuToken("expected-token", "expected-token") {
		t.Fatalf("expected token verification to pass when token matches")
	}
	if h.verifyFeishuToken("wrong-token", "expected-token") {
		t.Fatalf("expected token verification to fail when token mismatches")
	}
}

func TestApplyFeishuPayloadIgnoresServerManagedFields(t *testing.T) {
	connector := models.FeishuConnector{
		Enabled:            false,
		Status:             "not_connected",
		CallbackVerified:   false,
		RateLimitPerMinute: 30,
	}
	payload := map[string]any{
		"enabled":           true,
		"status":            "connected",
		"callback_verified": true,
		"app_id":            "cli-app-id",
	}

	if err := applyFeishuPayload(&connector, payload); err != nil {
		t.Fatalf("applyFeishuPayload returned error: %v", err)
	}

	if connector.AppID != "cli-app-id" {
		t.Fatalf("expected app_id to be updated, got %q", connector.AppID)
	}
	if connector.Enabled {
		t.Fatalf("expected enabled to remain server-managed")
	}
	if connector.Status != "not_connected" {
		t.Fatalf("expected status to remain server-managed, got %q", connector.Status)
	}
	if connector.CallbackVerified {
		t.Fatalf("expected callback_verified to remain server-managed")
	}
}

func TestInvalidateFeishuVerificationState(t *testing.T) {
	now := time.Now().UTC()
	connector := models.FeishuConnector{
		Enabled:           true,
		Status:            "connected",
		AppID:             "old-app",
		VerificationToken: "old-token",
		CallbackURL:       "https://old.example/callback",
		CallbackVerified:  true,
		LastVerifiedAt:    &now,
	}
	updated := connector
	updated.VerificationToken = "new-token"

	if !shouldInvalidateFeishuVerification(connector, updated) {
		t.Fatalf("expected verification state to be invalidated after token change")
	}

	invalidateFeishuVerification(&updated)
	if updated.Enabled {
		t.Fatalf("expected connector to be disabled after verification invalidation")
	}
	if updated.Status != "not_connected" {
		t.Fatalf("expected status to be reset after verification invalidation, got %q", updated.Status)
	}
	if updated.CallbackVerified {
		t.Fatalf("expected callback_verified to be reset after verification invalidation")
	}
	if updated.LastVerifiedAt != nil {
		t.Fatalf("expected last_verified_at to be cleared after verification invalidation")
	}
}
