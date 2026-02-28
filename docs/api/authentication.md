---
outline: deep
---

# Authentication

## Overview

EchoCenter uses JWT (JSON Web Token) for user authentication. After logging in, users receive a token, which must be carried in the `Authorization` header for subsequent requests.

## Login Flow

### Request

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MDAwMDAwMDB9.abc123"
}
```

### Token Structure

```
{
  "user_id": 1,
  "exp": 1700000000
}
```

## Registration Flow

### Request

```
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123"
}
```

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJleHAiOjE3MDAwMDAwMDB9.def456"
}
```

## Token Validation

### Middleware

```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "UNAUTHORIZED", Message: "Missing authorization header"}
            })
            c.Abort()
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(config.JWTSecret), nil
        })

        if err != nil || !token.Valid {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "INVALID_TOKEN", Message: "Invalid token"}
            })
            c.Abort()
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "INVALID_TOKEN", Message: "Invalid token claims"}
            })
            c.Abort()
            return
        }

        userID := uint(claims["user_id"].(float64))
        c.Set("user_id", userID)
        c.Next()
    }
}
```

## API Endpoints

### Login

```
POST /api/auth/login
```

**Request Body**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**
```json
{
  "token": "string"
}
```

### Register

```
POST /api/auth/register
```

**Request Body**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**
```json
{
  "token": "string"
}
```

## Permissions

### Roles

- `admin` - Administrator
- `user` - Regular user

### Access Control

- `admin` - All permissions
- `user` - Limited permissions

## Security

### Password Hashing

Bcrypt is used for password hashing:

```go
passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
```

### Token Expiration

Tokens expire after 24 hours by default:

```go
exp := time.Now().Add(time.Hour * 24).Unix()
```

## Configuration

The system requires the following environment variables to be set for authentication to work securely:

- `JWT_SECRET` - **(Mandatory)** A strong, unique secret key (at least 32 characters). The system will not start if this is missing or too short.
- `JWT_TOKEN_EXPIRATION` - (Optional) Duration of token validity (e.g., `24h`).
- `BCRYPT_COST` - (Optional) Work factor for password hashing (default: `12`).

## CORS

CORS protection configuration:

```go
app.Use(cors.New(cors.Config{
    AllowOrigins: []string{"http://localhost:3000"},
    AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
}))
```

## Error Handling

### Invalid Credentials

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

### Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}
```

### Invalid Token

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid token"
  }
}
```

## Frontend Integration

### Login

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
})

const data = await response.json()
localStorage.setItem('token', data.token)
```

### Sending Requests

```javascript
const token = localStorage.getItem('token')

const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## Best Practices

### 1. Token Storage

- Use `localStorage` or `sessionStorage`.
- Do not store in cookies (to prevent CSRF).

### 2. Token Refresh

- Refresh tokens before they expire.
- Use refresh tokens (future plan).

### 3. Token Revocation

- Clear token on logout.
- Server-side revocation (future plan).

### 4. Secure Transmission

- Use HTTPS.
- Do not pass tokens in URLs.
