package butler

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lea/echocenter/backend/internal/models"
	"github.com/lea/echocenter/backend/internal/observability"
)

func (s *ButlerService) handleUserMessageFlow(ctx context.Context, senderID int, payload string) {
	if s.brain == nil {
		return
	}

	sessionID := fmt.Sprintf("user_%d", senderID)
	streamID := uuid.New().String()
	systemState := s.buildSystemState(ctx)
	ctx, span := observability.StartSpan(ctx, "butler.user_message", "agent")
	defer span.Finish(ctx)
	span.SetThreadID(ctx, sessionID)
	spanInput := map[string]any{
		"sender_id":      senderID,
		"payload":        payload,
		"stream_id":      streamID,
		"system_state":   systemState,
		"payload_length": len(payload),
	}
	span.SetInput(ctx, spanInput)
	span.SetTags(ctx, map[string]any{
		"stream_id": streamID,
		"sender_id": senderID,
	})

	result, err := s.brain.ChatStream(ctx, sessionID, payload, systemState, func(chunk string) error {
		s.broadcastStreamChunk(senderID, streamID, chunk)
		return nil
	})
	if result != nil && result.PromptInfo.TotalMessages > 0 {
		spanInput["prompt_summary"] = result.PromptInfo
		span.SetInput(ctx, spanInput)
		span.SetTags(ctx, map[string]any{
			"prompt_messages":         result.PromptInfo.TotalMessages,
			"prompt_chars":            result.PromptInfo.TotalChars,
			"prompt_recent_window":    result.PromptInfo.RecentMessages,
			"prompt_summary_injected": result.PromptInfo.SummaryInjected,
		})
	}
	if err != nil {
		span.SetStatusCode(ctx, 1)
		span.SetError(ctx, err)
		log.Printf("[Butler] Error in chat reasoning: %v", err)
		return
	}
	span.SetOutput(ctx, map[string]any{
		"content":        strings.TrimSpace(result.Content),
		"response_chars": len(strings.TrimSpace(result.Content)),
	})

	s.persistAndBroadcastChat(ctx, senderID, streamID, strings.TrimSpace(result.Content))

	// Command execution is now handled automatically by ReAct Agent + CommandAgentTool
	// HasCommand and Command fields are deprecated and no longer used
	s.broadcastStreamEnd(senderID, streamID)
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

// HasPendingCommand checks whether an action is still awaiting authorization.
// Kept for compatibility with handlers that still use the old function name.
func HasPendingCommand(streamID string) bool {
	actionsMu.Lock()
	defer actionsMu.Unlock()
	_, ok := pendingActions[streamID]
	return ok
}
