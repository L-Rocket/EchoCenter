# API Contracts: User Login

## POST /api/auth/login
Authenticates a user and returns a session token.

### Request Body
```json
{
  "username": "admin",
  "password": "secure-password"
}
```

### Responses
- **200 OK**: Login successful.
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "ADMIN"
    }
  }
  ```
- **401 Unauthorized**: Invalid credentials.
  ```json
  { "error": "Invalid username or password" }
  ```

---

## POST /api/users
Creates a new user (Admin access required).

### Headers
- `Authorization: Bearer <token>`

### Request Body
```json
{
  "username": "new-operator",
  "password": "member-password",
  "role": "MEMBER"
}
```

### Responses
- **201 Created**: User created successfully.
- **403 Forbidden**: Current user is not an Admin.
- **409 Conflict**: Username already exists.

---

## Protected Endpoints (Existing)
The following existing endpoints now REQUIRE authentication:
- `GET /api/messages`
- `POST /api/messages`

### Headers Required
- `Authorization: Bearer <token>`

### Unauthorized Response (Generic)
- **401 Unauthorized**: Token missing, expired, or invalid.
  ```json
  { "error": "Unauthorized" }
  ```
