package butler

import "context"

type conversationContextKey struct{}

func WithConversationID(ctx context.Context, conversationID int) context.Context {
	if conversationID <= 0 {
		return ctx
	}
	return context.WithValue(ctx, conversationContextKey{}, conversationID)
}

func ConversationIDFromContext(ctx context.Context) int {
	if ctx == nil {
		return 0
	}
	conversationID, _ := ctx.Value(conversationContextKey{}).(int)
	return conversationID
}
