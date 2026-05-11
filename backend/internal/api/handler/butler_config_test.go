package handler

import (
	"errors"
	"fmt"
	"testing"
)

func TestIsTimeoutErrNilReturnsFalse(t *testing.T) {
	if isTimeoutErr(nil) {
		t.Fatal("expected false for nil error")
	}
}

func TestIsTimeoutErrTimeoutKeyword(t *testing.T) {
	cases := []struct {
		msg  string
		want bool
	}{
		{"connection timeout", true},
		{"TIMEOUT reached", true},
		{"deadline exceeded", true},
		{"context deadline exceeded", true},
		{"timed out waiting", true},
		{"connection refused", false},
		{"unexpected EOF", false},
		{"", false},
	}
	for _, tc := range cases {
		err := errors.New(tc.msg)
		if got := isTimeoutErr(err); got != tc.want {
			t.Errorf("isTimeoutErr(%q) = %v, want %v", tc.msg, got, tc.want)
		}
	}
}

func TestIsTimeoutErrWrappedError(t *testing.T) {
	inner := errors.New("i/o timeout")
	wrapped := fmt.Errorf("do request: %w", inner)
	if !isTimeoutErr(wrapped) {
		t.Fatal("expected true for wrapped timeout error")
	}
}
