package butler

import (
	"encoding/json"
	"fmt"
	"regexp"
)

const commandPrefix = "COMMAND_AGENT:"

var commandRegex = regexp.MustCompile(`COMMAND_AGENT:\s*({.*})`)

func extractCommandJSON(content string) (string, bool) {
	match := commandRegex.FindStringSubmatch(content)
	if len(match) <= 1 {
		return "", false
	}
	return match[1], true
}

func decodeCommandJSON(jsonParams string) (map[string]any, error) {
	var cmd map[string]any
	if err := json.Unmarshal([]byte(jsonParams), &cmd); err != nil {
		return nil, err
	}
	return cmd, nil
}

func parseCommandFromContent(content string) (map[string]any, string, bool) {
	jsonParams, ok := extractCommandJSON(content)
	if !ok {
		return nil, "", false
	}

	cmdMap, err := decodeCommandJSON(jsonParams)
	if err != nil {
		return nil, jsonParams, false
	}

	return cmdMap, jsonParams, true
}

func stripCommandFromContent(content string) string {
	return commandRegex.ReplaceAllString(content, "")
}

func parseCommandExecutionInput(command map[string]any) (int, string, string, error) {
	targetAgentID, ok := command["target_agent_id"].(float64)
	if !ok {
		return 0, "", "", fmt.Errorf("invalid target_agent_id")
	}

	commandText, ok := command["command"].(string)
	if !ok {
		return 0, "", "", fmt.Errorf("invalid command")
	}

	reasoning, _ := command["reasoning"].(string)
	return int(targetAgentID), commandText, reasoning, nil
}
