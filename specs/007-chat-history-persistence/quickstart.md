# Quickstart: Chat History Persistence

## Verification Steps

### 1. Generate Activity
1. Start the server and login as admin.
2. Open a chat with an Agent.
3. Send at least 5 messages.
4. Have the Agent respond (via `wscat` or seeder script).

### 2. Verify Persistence
1. Refresh the browser page.
2. Select the same Agent.
3. **Expectation**: The 10 messages (5 user + 5 agent) should reappear in the chat window immediately.

### 3. API Check (via curl)
```bash
# Replace <token> and <agent_id>
curl -H "Authorization: Bearer <token>" 
     http://localhost:8080/api/chat/history/<agent_id>
```
**Expectation**: Returns a JSON array of the most recent 50 messages.
