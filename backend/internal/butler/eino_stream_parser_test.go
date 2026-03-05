package butler

import (
	"strings"
	"testing"
)

func TestStreamCommandParser_NoCommand(t *testing.T) {
	parser := newStreamCommandParser()

	emit, stop := parser.consumeChunk("hello ")
	if emit != "" || stop {
		t.Fatalf("unexpected output on first chunk: emit=%q stop=%v", emit, stop)
	}

	emit, stop = parser.consumeChunk("world")
	if emit != "" || stop {
		t.Fatalf("unexpected output on second chunk: emit=%q stop=%v", emit, stop)
	}

	remaining := parser.flushRemaining()
	if remaining != "hello world" {
		t.Fatalf("unexpected remaining output: %q", remaining)
	}
	if parser.content() != "hello world" {
		t.Fatalf("unexpected final content: %q", parser.content())
	}
	if parser.commandText() != "" {
		t.Fatalf("expected no command text")
	}
}

func TestStreamCommandParser_CommandAcrossChunks(t *testing.T) {
	parser := newStreamCommandParser()

	emit, stop := parser.consumeChunk("Before command. COMMAND_")
	if emit != "" || stop {
		t.Fatalf("unexpected output before command complete: emit=%q stop=%v", emit, stop)
	}

	emit, stop = parser.consumeChunk("AGENT: {\"target_agent_id\": 3, \"command\": \"status\", ")
	if emit != "" || stop {
		t.Fatalf("unexpected output when command starts: emit=%q stop=%v", emit, stop)
	}

	emit, stop = parser.consumeChunk("\"reasoning\": \"check\"}")
	if emit != "" || !stop {
		t.Fatalf("expected stream to stop after complete command: emit=%q stop=%v", emit, stop)
	}

	if parser.content() != "" {
		t.Fatalf("unexpected content: %q", parser.content())
	}

	cmdText := parser.commandText()
	if !strings.Contains(cmdText, commandPrefix) {
		t.Fatalf("expected command prefix in buffered command: %q", cmdText)
	}

	cmdMap, _, ok := parseCommandFromContent(cmdText)
	if !ok {
		t.Fatalf("expected command parse success")
	}
	if got := cmdMap["command"].(string); got != "status" {
		t.Fatalf("unexpected command parsed: %s", got)
	}
}

func TestStreamCommandParser_CommandInSingleChunkDropsPreface(t *testing.T) {
	parser := newStreamCommandParser()

	emit, stop := parser.consumeChunk(`I will check now. COMMAND_AGENT: {"target_agent_id": 7, "command": "get_status", "reasoning": "user asked"}`)
	if emit != "" {
		t.Fatalf("expected no emitted preface when command exists, got: %q", emit)
	}
	if !stop {
		t.Fatalf("expected parser to stop after complete command in single chunk")
	}

	if parser.content() != "" {
		t.Fatalf("expected empty user-facing content when command exists, got: %q", parser.content())
	}

	cmdMap, _, ok := parseCommandFromContent(parser.commandText())
	if !ok {
		t.Fatalf("expected command parse success")
	}
	if got := cmdMap["target_agent_id"].(float64); got != 7 {
		t.Fatalf("unexpected target agent id parsed: %v", got)
	}
}

func TestStreamCommandParser_DoesNotFlushEarlyBeforeCommandDecision(t *testing.T) {
	parser := newStreamCommandParser()

	emit, stop := parser.consumeChunk("123456")
	if emit != "" {
		t.Fatalf("expected no early emit, got: %q", emit)
	}
	if stop {
		t.Fatalf("did not expect stop")
	}

	if parser.content() != "" {
		t.Fatalf("expected parser content buffered until flush, got: %q", parser.content())
	}

	remaining := parser.flushRemaining()
	if remaining != "123456" {
		t.Fatalf("expected flushRemaining to output buffered content, got: %q", remaining)
	}
	if parser.content() != "123456" {
		t.Fatalf("unexpected parser content after flush: %q", parser.content())
	}
}
