package butler

import "testing"

func resetPendingResponsesForTest() {
	actionsMu.Lock()
	defer actionsMu.Unlock()
	pendingResponses = make(map[int][]chan string)
}

func TestRegisterAgentResponse_FIFOQueue(t *testing.T) {
	resetPendingResponsesForTest()

	agentID := 42
	first := make(chan string, 1)
	second := make(chan string, 1)

	enqueuePendingResponse(agentID, first)
	enqueuePendingResponse(agentID, second)

	if ok := RegisterAgentResponse(agentID, "first-response"); !ok {
		t.Fatalf("expected first registration to succeed")
	}
	if got := <-first; got != "first-response" {
		t.Fatalf("unexpected first response: %q", got)
	}

	if ok := RegisterAgentResponse(agentID, "second-response"); !ok {
		t.Fatalf("expected second registration to succeed")
	}
	if got := <-second; got != "second-response" {
		t.Fatalf("unexpected second response: %q", got)
	}

	if ok := RegisterAgentResponse(agentID, "no-listener"); ok {
		t.Fatalf("expected registration to fail when queue is empty")
	}
}

func TestRemovePendingResponse_RemovesSpecificChannel(t *testing.T) {
	resetPendingResponsesForTest()

	agentID := 99
	first := make(chan string, 1)
	second := make(chan string, 1)
	third := make(chan string, 1)

	enqueuePendingResponse(agentID, first)
	enqueuePendingResponse(agentID, second)
	enqueuePendingResponse(agentID, third)

	removePendingResponse(agentID, second)

	popped, ok := popPendingResponse(agentID)
	if !ok || popped != first {
		t.Fatalf("expected first channel after removing middle one")
	}

	popped, ok = popPendingResponse(agentID)
	if !ok || popped != third {
		t.Fatalf("expected third channel to become second in queue")
	}

	if _, ok = popPendingResponse(agentID); ok {
		t.Fatalf("expected queue to be empty")
	}
}
