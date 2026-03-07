# Research: EchoCenter MVP

## Decisions

### Decision: Web Framework - Gin
- **Decision**: Use `github.com/gin-gonic/gin`.
- **Rationale**: Highly performance-oriented, idiomatic for Go, and provides excellent middleware support (CORS, logging, recovery) which is essential for rapid development without reinventing the wheel.
- **Alternatives considered**: Standard `net/http` (too much boilerplate for routing/JSON), Echo (similar to Gin, but Gin has broader community support for simple MVPs).

### Decision: Database Driver
- **Decision**: Use a Go-native SQL driver strategy that keeps the backend simple to run and distribute.
- **Rationale**: Given the "Pragmatic Minimalism" principle, prefer a setup that avoids unnecessary CGO-related cross-compilation complexity.
- **Alternatives considered**: PostgreSQL/MySQL (overkill for an MVP with low write volume).

### Decision: Frontend - React + Vite + Tailwind CSS
- **Decision**: React for state management, Vite for fast development, Tailwind CSS for rapid styling.
- **Rationale**: This is the modern industry standard for building responsive, performant UIs quickly. Tailwind allows styling without writing extensive CSS files.
- **Alternatives considered**: Plain JS/HTML (harder to maintain as the dashboard grows), Next.js (overkill for a single-page monitoring dashboard).

### Decision: Real-time Update Strategy - Polling
- **Decision**: `setInterval` in React to fetch `/api/messages` every 2 seconds.
- **Rationale**: Simplest possible implementation for the MVP (FR-008). Avoids the complexity of WebSockets or SSE for a simple 50-message display.
- **Alternatives considered**: WebSockets (more complex to implement and maintain in the initial stage).

## Best Practices

### Gin CORS Configuration
- MUST use `github.com/gin-contrib/cors` or a custom middleware to allow the frontend (likely running on a different port during development) to access the backend API.

### Schema Optimization
- The `messages` table should have an index on `timestamp` (DESC) to ensure retrieval of the latest 50 messages is instantaneous as the database grows.

### React State Management
- Use `useEffect` and `useState` for the polling cycle. Ensure the interval is cleared on component unmount to prevent memory leaks.
