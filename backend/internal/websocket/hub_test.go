package websocket

import (
	"testing"
	"time"
)

func TestHubRouting(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// Mock clients
	client1 := &Client{userID: 1, send: make(chan *Message, 1)}
	client2 := &Client{userID: 2, send: make(chan *Message, 1)}

	hub.register <- client1
	hub.register <- client2

	// Wait for registration
	time.Sleep(100 * time.Millisecond)

	// Test Targeted Message
	msg := &Message{
		Type:     "CHAT",
		TargetID: 2,
		Payload:  "Hello Client 2",
	}
	hub.broadcast <- msg

	select {
	case received := <-client2.send:
		if received.Payload != "Hello Client 2" {
			t.Errorf("Expected 'Hello Client 2', got %v", received.Payload)
		}
	case <-time.After(1 * time.Second):
		t.Error("Timed out waiting for targeted message")
	}

	// Test Broadcast (TargetID 0)
	msgBroadcast := &Message{
		Type:    "CHAT",
		Payload: "Global message",
	}
	hub.broadcast <- msgBroadcast

	// Both should receive
	for i, c := range []*Client{client1, client2} {
		select {
		case received := <-c.send:
			if received.Payload != "Global message" {
				t.Errorf("Client %d: Expected 'Global message', got %v", i+1, received.Payload)
			}
		case <-time.After(1 * time.Second):
			t.Errorf("Client %d: Timed out waiting for broadcast", i+1)
		}
	}
}
