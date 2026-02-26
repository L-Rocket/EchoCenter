# Research: User Login

## Decisions

### Decision: Authentication Mechanism - JWT (Stateless)
- **Decision**: Use JSON Web Tokens (JWT) for session management.
- **Rationale**: JWT is the industry standard for stateless authentication in SPAs (Single Page Applications). It avoids the need for server-side session storage (like Redis or DB sessions) in the MVP, fitting the "Stateless" and "High-Leverage" principles.
- **Library**: `github.com/golang-jwt/jwt/v5` for Go.

### Decision: Password Hashing - Bcrypt
- **Decision**: Use `bcrypt` for secure password storage.
- **Rationale**: Bcrypt is a battle-tested, standard slow-hashing algorithm that is resistant to brute-force attacks. It is widely supported in the Go ecosystem via `golang.org/x/crypto/bcrypt`.
- **Alternatives considered**: Argon2 (more modern but slightly more complex to configure; bcrypt is sufficient for this MVP).

### Decision: Frontend Auth State - React Context
- **Decision**: Use a simple `AuthContext` to manage the user's logged-in state and token.
- **Rationale**: For a small application like EchoCenter, React Context is the built-in, "popular" way to share global state (like auth status) without adding heavy state-management libraries like Redux or Zustand.
- **Storage**: Store the JWT in `localStorage` for persistence across refreshes.

### Decision: API Security - Bearer Token Interceptor
- **Decision**: Use Axios interceptors to automatically attach the `Authorization: Bearer <token>` header to all outgoing requests.
- **Rationale**: Dry (Don't Repeat Yourself) principle. It ensures all API calls are authenticated without manual header injection in every component.

## Best Practices

### JWT Secret Management
- The JWT signing key MUST be loaded from an environment variable (`JWT_SECRET`) and NOT hardcoded. A fallback warning should be issued during development if it's missing.

### CSRF and XSS Considerations
- Since the JWT is stored in `localStorage`, it is vulnerable to XSS. However, for a local-first MVP, this is an acceptable trade-off for implementation speed. In a production environment, `HttpOnly` cookies would be preferred.

### Admin Initialization
- On startup, the backend will check the `users` table. If empty, it will read `INITIAL_ADMIN_USER` and `INITIAL_ADMIN_PASS` from `.env` to create the first record.
