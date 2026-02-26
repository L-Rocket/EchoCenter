# Quickstart: Agent Chat Integration

## 1. Register an Agent
As an Admin, use the new "Team" or "Agents" UI to create a new Agent.
Copy the generated **API Token**.

## 2. Connect an External Agent
Run a script using the token to connect to the WebSocket:
```bash
# Conceptual example using a CLI tool like 'wscat'
wscat -c "ws://localhost:8080/api/ws?token=YOUR_AGENT_TOKEN"
```

## 3. Start a Conversation
1. Open the EchoCenter Dashboard as a Human User.
2. Select the new Agent from the sidebar.
3. Type a message in the chat dialog.
4. Verify the external agent receives it and can respond.

## 4. Troubleshooting
- **401 Unauthorized**: Check if your token is copied correctly or if the agent has been deleted.
- **Connection Closed**: Ensure the backend is running and the WebSocket port is accessible.
