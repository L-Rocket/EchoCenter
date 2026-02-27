# Quickstart: Agent Butler Coordination

## Configuration (Action Required)

To enable the Butler's intelligence, you must fill in the placeholders in `backend/.env`:

1.  Open `backend/.env`.
2.  Locate and fill the following fields:
    ```env
    # Butler Service Configuration (Eino Brain)
    BUTLER_BASE_URL="<YOUR_BUTLER_SERVICE_URL>"
    BUTLER_API_TOKEN="<YOUR_BUTLER_API_TOKEN>"
    ```

## Verification Steps

### 1. Test situational awareness
1. Start the server.
2. Ingest a log from a sub-agent (e.g., via the dashboard or seeder).
3. Check the backend server logs.
4. **Expectation**: You should see the Eino Butler instance receiving and processing the log.

### 2. Test Authorization Gate
1. Interact with `Butler` in the chat.
2. Ask it to perform an action on another agent (e.g., "Reset the Weather-Sentinel").
3. **Expectation**: Instead of an instant confirmation, an **Authorization Card** appears in the chat.
4. Click **"Approve"**.
5. **Expectation**: The command is delivered to the target agent, and the card updates to "APPROVED".
