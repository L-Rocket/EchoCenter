package handler

import "testing"

func TestBuildFeishuWSURL(t *testing.T) {
	got, err := buildFeishuWSURL("wss://open.feishu.cn/open-apis/ws/v2", "app_1", "sec_1")
	if err != nil {
		t.Fatalf("buildFeishuWSURL returned error: %v", err)
	}
	if got == "" {
		t.Fatalf("expected non-empty url")
	}
	if !containsAll(got, "app_id=app_1", "app_secret=sec_1") {
		t.Fatalf("unexpected ws url: %s", got)
	}

	got, err = buildFeishuWSURL("wss://open.feishu.cn/open-apis/ws/v2?app_id=keep&foo=bar", "app_2", "sec_2")
	if err != nil {
		t.Fatalf("buildFeishuWSURL returned error: %v", err)
	}
	if !containsAll(got, "app_id=keep", "foo=bar", "app_secret=sec_2") {
		t.Fatalf("unexpected ws url with existing query: %s", got)
	}
}

func TestUnwrapFeishuWSMessage(t *testing.T) {
	raw := []byte(`{"id":"msg-1","payload":{"event":{"message":{"message_id":"om_1"}},"token":"tok"}}`)
	payload, ackID := unwrapFeishuWSMessage(raw)
	if ackID != "msg-1" {
		t.Fatalf("expected ack id msg-1, got %q", ackID)
	}
	if payload == nil {
		t.Fatalf("expected payload")
	}
	if token := stringFromMap(payload, "token"); token != "tok" {
		t.Fatalf("expected token=tok, got %q", token)
	}

	raw = []byte(`{"uuid":"u-1","payload":"{\"event\":{\"message\":{\"message_id\":\"om_2\"}},\"token\":\"tok2\"}"}`)
	payload, ackID = unwrapFeishuWSMessage(raw)
	if ackID != "u-1" {
		t.Fatalf("expected ack id u-1, got %q", ackID)
	}
	if payload == nil || stringFromMap(payload, "token") != "tok2" {
		t.Fatalf("expected decoded json payload")
	}
}

func containsAll(s string, subs ...string) bool {
	for _, sub := range subs {
		if sub == "" {
			continue
		}
		if !contains(s, sub) {
			return false
		}
	}
	return true
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && (indexOf(s, sub) >= 0))
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
