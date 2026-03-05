package handler

import "testing"

func TestFeishuDomainFromWSURL(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "default",
			raw:  "",
			want: "https://open.feishu.cn",
		},
		{
			name: "from ws endpoint",
			raw:  "wss://open.feishu.cn/open-apis/ws/v2",
			want: "https://open.feishu.cn",
		},
		{
			name: "from https domain",
			raw:  "https://open.feishu.cn",
			want: "https://open.feishu.cn",
		},
		{
			name: "invalid fallback",
			raw:  "://bad_url",
			want: "https://open.feishu.cn",
		},
	}

	for _, tt := range tests {
		if got := feishuDomainFromWSURL(tt.raw); got != tt.want {
			t.Fatalf("%s: expected %q, got %q", tt.name, tt.want, got)
		}
	}
}

func TestVerifyFeishuWSToken(t *testing.T) {
	if !verifyFeishuWSToken(map[string]any{}, "") {
		t.Fatalf("expected empty expected token to pass in ws mode")
	}

	payload := map[string]any{"token": "tok_1"}
	if !verifyFeishuWSToken(payload, "tok_1") {
		t.Fatalf("expected matching token to pass")
	}
	if verifyFeishuWSToken(payload, "tok_2") {
		t.Fatalf("expected mismatched token to fail")
	}
	if verifyFeishuWSToken(map[string]any{}, "tok_1") {
		t.Fatalf("expected missing token to fail when expected token is configured")
	}
}

func TestHasFeishuWSToken(t *testing.T) {
	if hasFeishuWSToken(nil) {
		t.Fatalf("expected nil payload to have no token")
	}
	if hasFeishuWSToken(map[string]any{}) {
		t.Fatalf("expected empty payload to have no token")
	}
	if !hasFeishuWSToken(map[string]any{"token": "tok_1"}) {
		t.Fatalf("expected direct token to be detected")
	}
	if !hasFeishuWSToken(map[string]any{"header": map[string]any{"token": "tok_2"}}) {
		t.Fatalf("expected header token to be detected")
	}
}
