package errors

import (
	"errors"
	"fmt"
)

// Application error types
var (
	ErrNotFound          = errors.New("resource not found")
	ErrInvalidInput      = errors.New("invalid input")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrConflict          = errors.New("resource conflict")
	ErrInternal          = errors.New("internal server error")
	ErrDatabase          = errors.New("database error")
	ErrValidation        = errors.New("validation error")
	ErrTokenExpired      = errors.New("token expired")
	ErrTokenInvalid      = errors.New("invalid token")
	ErrInvalidCredentials = errors.New("invalid credentials")
)

// AppError represents an application error with context
type AppError struct {
	Type    error
	Message string
	Cause   error
}

func (e *AppError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Type
}

// Is reports whether err is of the same type as target
func (e *AppError) Is(target error) bool {
	return errors.Is(e.Type, target)
}

// New creates a new application error
func New(errType error, message string) *AppError {
	return &AppError{
		Type:    errType,
		Message: message,
	}
}

// Wrap wraps an existing error with context
func Wrap(errType error, message string, cause error) *AppError {
	return &AppError{
		Type:    errType,
		Message: message,
		Cause:   cause,
	}
}

// Is checks if an error is of a specific type
func Is(err, target error) bool {
	if err == nil {
		return false
	}
	
	var appErr *AppError
	if errors.As(err, &appErr) {
		return errors.Is(appErr.Type, target)
	}
	
	return errors.Is(err, target)
}

// As finds the first error in err's chain that matches target
func As(err error, target any) bool {
	return errors.As(err, target)
}
