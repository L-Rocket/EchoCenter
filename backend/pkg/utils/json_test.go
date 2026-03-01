package utils

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestJSON(t *testing.T) {
	type TestStruct struct {
		Name string `json:"name"`
		Age  int    `json:"age"`
	}

	obj := TestStruct{Name: "Echo", Age: 1}
	jsonStr := ToJSON(obj)
	assert.Contains(t, jsonStr, `"name":"Echo"`)
	assert.Contains(t, jsonStr, `"age":1`)

	var parsed TestStruct
	err := ParseJSON(jsonStr, &parsed)
	assert.NoError(t, err)
	assert.Equal(t, obj, parsed)
}
