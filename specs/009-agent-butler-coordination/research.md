# Research: Agent Butler Coordination (my-agent)

## Decisions

### Decision: Butler Intelligence Framework - Eino
- **Decision**: Use ByteDance's **Eino** framework for Go.
- **Rationale**: Eino provides a robust, graph-based orchestration model that is highly suitable for implementing complex state-driven agent logic, such as "interrupt and wait for authorization". Its strong typing and modularity align with the project's engineering standards.
- **Implementation**: The Butler's "brain" will be an Eino `Chain` or `Graph` that processes system logs and user instructions.

### Decision: Human-in-the-Loop (HITL) Authorization Mechanism
- **Decision**: Implement a custom Eino `Tool` wrapper that checks for a valid `AuthorizationToken` before execution.
- **Rationale**: This ensures that even if the LLM decides to call a command tool, the execution is physically blocked at the code level unless an "Approved" state exists in the database for that specific action ID.
- **Workflow**:
    1. Eino Agent decides to call `CommandAgent`.
    2. The tool logic generates a unique `ActionID`, saves a `PENDING` request to the database, and returns a special "Authorization Required" response to the Eino loop.
    3. The backend sends an `AUTH_REQUEST` via WebSocket to the frontend.
    4. Upon user approval, the backend updates the request to `APPROVED` and signals the Eino loop to resume.

### Decision: Butler Integration Architecture
- **Decision**: The Butler will exist as a singleton instance within the backend process, running its own Eino loop.
- **Rationale**: Simplifies communication between the system's WebSocket Hub and the Butler's ingestion logic.

## Best Practices

### Eino Orchestration
- Use Eino's `Compose` package to build the tool-calling graph.
- Leverage `State` to manage the conversation context and pending actions.

### Security
- The Butler's `api_token` and `URL` will be stored in the `.env` file (placeholders provided for the user).
- Ensure that only messages from the designated `my-agent` can trigger system-level commands.
