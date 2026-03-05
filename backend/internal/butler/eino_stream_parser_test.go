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
	if emit != "Before command. " || stop {
		t.Fatalf("unexpected output when command starts: emit=%q stop=%v", emit, stop)
	}

	emit, stop = parser.consumeChunk("\"reasoning\": \"check\"}")
	if emit != "" || !stop {
		t.Fatalf("expected stream to stop after complete command: emit=%q stop=%v", emit, stop)
	}

	if parser.content() != "Before command. " {
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

func TestStreamCommandParser_FlushThreshold(t *testing.T) {
	parser := newStreamCommandParser()
	parser.flushThreshold = 5

	emit, stop := parser.consumeChunk("123456")
	if emit != "123456" {
		t.Fatalf("expected immediate flush, got: %q", emit)
	}
	if stop {
		t.Fatalf("did not expect stop")
	}

	if parser.content() != "123456" {
		t.Fatalf("unexpected parser content: %q", parser.content())
	}
}
