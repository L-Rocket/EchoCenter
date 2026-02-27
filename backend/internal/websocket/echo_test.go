package websocket

import (
	"testing"
	"time"
)

func TestHubEchoBack(t *testing.T) {
	h := NewHub()
	go h.Run()

	// 1. Register two clients
	sender := &Client{userID: 1, send: make(chan *Message, 10)}
	target := &Client{userID: 2, send: make(chan *Message, 10)}

	h.register <- sender
	h.register <- target
	time.Sleep(100 * time.Millisecond)

	// 2. Send a direct message from sender (1) to target (2)
	msg := &Message{
		Type:     "CHAT",
		SenderID: 1,
		TargetID: 2,
		Payload:  "Echo check",
	}
	h.broadcast <- msg

	// 3. Verify target received it
	select {
	case received := <-target.send:
		if received.Payload != "Echo check" {
			t.Errorf("Target did not receive correct payload: %v", received.Payload)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Target timed out waiting for direct message")
	}

	// 4. Verify sender also received it (ECHO)
	select {
	case received := <-sender.send:
		if received.Payload != "Echo check" {
			t.Errorf("Sender did not receive correct echo: %v", received.Payload)
		}
		if received.SenderID != 1 {
			t.Errorf("Echo SenderID mismatch: %d", received.SenderID)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Sender did not receive echo back from hub")
	}
}

func TestBroadcastGenericConversion(t *testing.T) {
	h := NewHub()
	go h.Run()

	// Register a client to receive
	client := &Client{userID: 2, send: make(chan *Message, 10)}
	h.register <- client
	time.Sleep(100 * time.Millisecond)

	// Use BroadcastGeneric with a map
	h.BroadcastGeneric(map[string]interface{}{
		"type":        "CHAT",
		"sender_id":   1,
		"target_id":   2,
		"sender_name": "TestBot",
		"payload":     "Hello from map",
	})

	select {
	case received := <-client.send:
		if received.Type != "CHAT" {
			t.Errorf("Incorrect type: %s", received.Type)
		}
		if received.SenderID != 1 {
			t.Errorf("Incorrect SenderID: %d", received.SenderID)
		}
		if received.TargetID != 2 {
			t.Errorf("Incorrect TargetID: %d", received.TargetID)
		}
		if received.SenderName != "TestBot" {
			t.Errorf("Incorrect SenderName: %s", received.SenderName)
		}
		if received.Payload != "Hello from map" {
			t.Errorf("Incorrect Payload: %v", received.Payload)
		}
		if received.Timestamp == "" {
			t.Error("Timestamp should not be empty")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Client did not receive Generic message")
	}
}
