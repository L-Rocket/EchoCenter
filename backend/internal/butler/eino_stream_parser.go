package butler

import "strings"

type streamCommandParser struct {
	fullReply     strings.Builder
	commandBuffer strings.Builder
	checkBuffer   strings.Builder
	inCommand     bool
}

func newStreamCommandParser() *streamCommandParser {
	return &streamCommandParser{}
}

func (p *streamCommandParser) consumeChunk(chunk string) (emit string, shouldStop bool) {
	if chunk == "" {
		return "", false
	}

	if !p.inCommand {
		p.checkBuffer.WriteString(chunk)
		checkStr := p.checkBuffer.String()

		if strings.Contains(checkStr, commandPrefix) {
			p.inCommand = true
			parts := strings.SplitN(checkStr, commandPrefix, 2)
			// When a command is detected, do not emit speculative preface text.
			// AUTH_REQUEST is the authoritative next UI event.

			p.commandBuffer.WriteString(commandPrefix)
			if len(parts) > 1 {
				p.commandBuffer.WriteString(parts[1])
			}

			p.checkBuffer.Reset()
			cmdStr := p.commandBuffer.String()
			if strings.Count(cmdStr, "{") > 0 && strings.Count(cmdStr, "{") == strings.Count(cmdStr, "}") {
				return emit, true
			}
			return emit, false
		}

		return "", false
	}

	p.commandBuffer.WriteString(chunk)
	cmdStr := p.commandBuffer.String()
	if strings.Count(cmdStr, "{") > 0 && strings.Count(cmdStr, "{") == strings.Count(cmdStr, "}") {
		return "", true
	}

	return "", false
}

func (p *streamCommandParser) flushRemaining() string {
	if p.inCommand || p.checkBuffer.Len() == 0 {
		return ""
	}

	emit := p.checkBuffer.String()
	p.fullReply.WriteString(emit)
	p.checkBuffer.Reset()
	return emit
}

func (p *streamCommandParser) content() string {
	return p.fullReply.String()
}

func (p *streamCommandParser) commandText() string {
	return p.commandBuffer.String()
}
