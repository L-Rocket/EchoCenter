package websocket

import "testing"

func TestRouteToTarget_EchoesHumanSender(t *testing.T) {
	h := &hub{
		clients: map[int]*Client{
			1: {userID: 1, send: make(chan *Message, 1)},
			7: {userID: 7, send: make(chan *Message, 1)},
		},
	}

	msg := &Message{
		Type:       MessageTypeChat,
		SenderID:   1,
		SenderRole: "ADMIN",
		TargetID:   7,
		Payload:    "hello",
	}

	h.routeToTarget(msg)

	select {
	case got := <-h.clients[7].send:
		if got != msg {
			t.Fatalf("expected target to receive original message pointer")
		}
	default:
		t.Fatalf("expected target to receive routed message")
	}

	select {
	case got := <-h.clients[1].send:
		if got != msg {
			t.Fatalf("expected sender echo to be original message pointer")
		}
	default:
		t.Fatalf("expected human sender to receive echo")
	}
}

func TestRouteToTarget_DoesNotEchoAgentSender(t *testing.T) {
	h := &hub{
		clients: map[int]*Client{
			1: {userID: 1, send: make(chan *Message, 1)},
			7: {userID: 7, send: make(chan *Message, 1)},
		},
	}

	msg := &Message{
		Type:       MessageTypeChatStream,
		SenderID:   7,
		SenderRole: "AGENT",
		TargetID:   1,
		Payload:    "chunk",
	}

	h.routeToTarget(msg)

	select {
	case got := <-h.clients[1].send:
		if got != msg {
			t.Fatalf("expected target to receive original message pointer")
		}
	default:
		t.Fatalf("expected target to receive routed message")
	}

	select {
	case <-h.clients[7].send:
		t.Fatalf("did not expect echo back to AGENT sender")
	default:
	}
}

