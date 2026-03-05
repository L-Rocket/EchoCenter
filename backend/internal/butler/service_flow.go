package butler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/models"
)

func (s *ButlerService) handleUserMessageFlow(ctx context.Context, senderID int, payload string) {
	if s.brain == nil {
		return
	}

	sessionID := fmt.Sprintf("user_%d", senderID)
	streamID := uuid.New().String()
	systemState := s.buildSystemState(ctx)

	result, err := s.brain.ChatStream(ctx, sessionID, payload, systemState, func(chunk string) error {
		s.broadcastStreamChunk(senderID, streamID, chunk)
		return nil
	})
	if err != nil {
		log.Printf("[Butler] Error in chat reasoning: %v", err)
		return
	}

	s.persistAndBroadcastChat(ctx, senderID, streamID, strings.TrimSpace(result.Content))

	if result.HasCommand {
		s.handlePendingCommandRequest(ctx, senderID, streamID, result)
		s.broadcastStreamEnd(senderID, streamID)
		return
	}

	s.broadcastStreamEnd(senderID, streamID)
}

func (s *ButlerService) executePendingCommandFlow(ctx context.Context, streamID string, senderID int, approved bool) {
	result, exists := popPendingCommand(streamID)
	if !exists {
		log.Printf("[Butler] No pending command found for streamID: %s", streamID)
		return
	}

	status := "REJECTED"
	if approved {
		status = "APPROVED"
	}
	if err := s.repo.UpdateAuthRequestStatus(ctx, streamID, status); err != nil {
		log.Printf("[Butler] Failed to update AUTH_REQUEST status: %v", err)
	}
	s.broadcastAuthStatusUpdate(streamID, status)

	if !approved {
		s.broadcastChat(senderID, streamID, "Command cancelled by user.")
		s.broadcastStreamEnd(senderID, streamID)
		return
	}

	if s.brain == nil {
		log.Printf("[Butler] Brain not initialized while executing approved command")
		s.broadcastStreamEnd(senderID, streamID)
		return
	}

	execResult, err := s.brain.ExecuteCommand(ctx, result, func(chunk string) error {
		s.broadcastStreamChunk(senderID, streamID, chunk)
		return nil
	})
	if err != nil {
		log.Printf("[Butler] Error executing command: %v", err)
	} else {
		s.persistAndBroadcastChat(ctx, senderID, streamID, strings.TrimSpace(execResult))
	}

	s.broadcastStreamEnd(senderID, streamID)
}

func (s *ButlerService) handlePendingCommandRequest(ctx context.Context, senderID int, streamID string, result *ChatStreamResult) {
	storePendingCommand(streamID, result)

	agentID := parseTargetAgentID(result.Command["target_agent_id"])
	authPayload := map[string]any{
		"action_id":         streamID,
		"target_agent_name": fmt.Sprintf("Agent %d", agentID),
		"command":           result.Command["command"],
		"reason":            result.Command["reasoning"],
		"status":            "PENDING",
	}

	payloadBytes, _ := json.Marshal(authPayload)
	authChatMsg := &models.ChatMessage{
		LocalID:    uuid.New().String(),
		SenderID:   s.butlerID,
		ReceiverID: senderID,
		Type:       "AUTH_REQUEST",
		Payload:    string(payloadBytes),
	}

	if err := s.repo.SaveChatMessage(ctx, authChatMsg); err != nil {
		log.Printf("[Butler] Failed to persist AUTH_REQUEST: %v", err)
	}

	s.broadcast(map[string]any{
		"id":          authChatMsg.ID,
		"local_id":    authChatMsg.LocalID,
		"type":        "AUTH_REQUEST",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   senderID,
		"payload":     authPayload,
		"timestamp":   authChatMsg.Timestamp.Format(time.RFC3339Nano),
	})
}

func (s *ButlerService) buildSystemState(ctx context.Context) string {
	agents, err := s.repo.GetAgents(ctx)
	if err != nil {
		return "System error: Unable to retrieve agent list."
	}

	var builder strings.Builder
	builder.WriteString("Active Agents in the hive (excluding myself):\n")
	for _, a := range agents {
		if a.ID == s.butlerID {
			continue
		}
		builder.WriteString(fmt.Sprintf("- %s (ID: %d, Role: %s)\n", a.Username, a.ID, a.Role))
	}

	return builder.String()
}

func (s *ButlerService) persistAndBroadcastChat(ctx context.Context, senderID int, streamID string, content string) {
	if content == "" {
		return
	}

	chatMsg := &models.ChatMessage{
		LocalID:    uuid.New().String(),
		SenderID:   s.butlerID,
		ReceiverID: senderID,
		Payload:    content,
	}

	if err := s.repo.SaveChatMessage(ctx, chatMsg); err != nil {
		log.Printf("[Butler] Failed to persist chat: %v", err)
	}

	s.broadcast(map[string]any{
		"id":          chatMsg.ID,
		"local_id":    chatMsg.LocalID,
		"stream_id":   streamID,
		"type":        "CHAT",
		"sender_id":   chatMsg.SenderID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   chatMsg.ReceiverID,
		"payload":     chatMsg.Payload,
		"timestamp":   chatMsg.Timestamp.Format(time.RFC3339Nano),
	})

	// Best-effort outbound relay: mirror Butler reply into Feishu when admin is the receiver.
	go s.forwardButlerReplyToFeishu(context.Background(), chatMsg.ReceiverID, content)
}

func (s *ButlerService) broadcastStreamChunk(senderID int, streamID, chunk string) {
	s.broadcast(map[string]any{
		"type":        "CHAT_STREAM",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   senderID,
		"payload":     chunk,
		"stream_id":   streamID,
	})
}

func (s *ButlerService) broadcastStreamEnd(senderID int, streamID string) {
	s.broadcast(map[string]any{
		"type":        "CHAT_STREAM_END",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   senderID,
		"payload":     "",
		"stream_id":   streamID,
	})
}

func (s *ButlerService) broadcastChat(senderID int, streamID, payload string) {
	s.broadcast(map[string]any{
		"type":        "CHAT",
		"sender_id":   s.butlerID,
		"sender_name": s.butlerName,
		"sender_role": "BUTLER",
		"target_id":   senderID,
		"payload":     payload,
		"stream_id":   streamID,
	})
}

func (s *ButlerService) broadcastAuthStatusUpdate(actionID, status string) {
	s.broadcast(map[string]any{
		"type": "AUTH_STATUS_UPDATE",
		"payload": map[string]any{
			"action_id": actionID,
			"status":    status,
		},
	})
}

func (s *ButlerService) broadcast(msg map[string]any) {
	if s.hub == nil {
		return
	}
	s.hub.BroadcastGeneric(msg)
}

func storePendingCommand(streamID string, result *ChatStreamResult) {
	pendingCommandsMu.Lock()
	defer pendingCommandsMu.Unlock()
	pendingCommands[streamID] = result
}

func popPendingCommand(streamID string) (*ChatStreamResult, bool) {
	pendingCommandsMu.Lock()
	defer pendingCommandsMu.Unlock()

	result, exists := pendingCommands[streamID]
	if exists {
		delete(pendingCommands, streamID)
	}
	return result, exists
}

func parseTargetAgentID(value any) int {
	switch v := value.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		id, err := strconv.Atoi(v)
		if err == nil {
			return id
		}
	}
	return 0
}
