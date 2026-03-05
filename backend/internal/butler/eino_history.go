package butler

import "github.com/cloudwego/eino/schema"

func (b *EinoBrain) prepareConversation(sessionID, input, systemState string) []*schema.Message {
	b.historyMu.Lock()
	defer b.historyMu.Unlock()

	msgs := b.history[sessionID]
	systemPrompt := buildButlerSystemPrompt(systemState)

	if len(msgs) == 0 {
		msgs = append(msgs, schema.SystemMessage(systemPrompt))
	} else if msgs[0].Role == schema.System {
		msgs[0].Content = systemPrompt
	}

	msgs = append(msgs, schema.UserMessage(input))
	b.history[sessionID] = msgs
	return msgs
}

func (b *EinoBrain) appendHistory(sessionID string, messages ...*schema.Message) {
	b.historyMu.Lock()
	defer b.historyMu.Unlock()
	b.history[sessionID] = append(b.history[sessionID], messages...)
}

func (b *EinoBrain) trimHistory(sessionID string) {
	if len(b.history[sessionID]) > 21 {
		newHistory := []*schema.Message{b.history[sessionID][0]}
		newHistory = append(newHistory, b.history[sessionID][len(b.history[sessionID])-20:]...)
		b.history[sessionID] = newHistory
	}
}
