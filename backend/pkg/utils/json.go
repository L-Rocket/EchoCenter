package utils

import (
	"encoding/json"
	"fmt"
)

// ToJSON converts any value to a JSON string, primarily for logging or debugging
func ToJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("error marshaling to json: %v", err)
	}
	return string(b)
}

// ParseJSON parses a JSON string into a target interface
func ParseJSON(data string, v any) error {
	return json.Unmarshal([]byte(data), v)
}
