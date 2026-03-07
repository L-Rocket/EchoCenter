# Data Model: User Login

## Entity: User
Represents an authorized system operator.

### Attributes (Table `users`)
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| `id` | INTEGER | Primary key | AUTOINCREMENT |
| `username` | TEXT | Unique login name | NOT NULL, UNIQUE |
| `password_hash` | TEXT | Securely hashed password | NOT NULL |
| `role` | TEXT | User permission level (ADMIN, MEMBER) | NOT NULL, DEFAULT 'MEMBER' |
| `created_at` | DATETIME | Account creation time | DEFAULT CURRENT_TIMESTAMP |

### Go Struct Mapping
```go
type User struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username" binding:"required"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose hash in JSON
	Role         string    `json:"role" db:"role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
```

### Validation Rules
- `Username`: MUST be unique. Min length 3 characters.
- `Password`: MUST NOT be stored in plain text.
- `Role`: Restricted to (ADMIN, MEMBER).

### Auth Flow
1. **Login**: User submits `LoginRequest`.
2. **Verify**: Backend fetches `User` by username, compares `Password` with `PasswordHash` using `bcrypt.CompareHashAndPassword`.
3. **Sign**: If valid, backend signs a JWT with `user_id` and `role` claims.
4. **Respond**: Return `LoginResponse` containing the JWT.
