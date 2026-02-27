# API Contracts: Agent Butler Coordination

## WebSocket Message: AUTH_REQUEST
Sent from Backend (Butler Logic) to Frontend (User) when a command requires approval.

```json
{
  "type": "AUTH_REQUEST",
  "sender_id": 999, // Butler ID
  "payload": {
    "action_id": "uuid-v4-string",
    "target_agent_id": 42,
    "target_agent_name": "Weather-Sentinel",
    "command": "RESTART_SCAN",
    "reason": "Satellite feed shows significant pressure changes requiring re-calibration."
  },
  "timestamp": "2026-02-25T14:00:00Z"
}
```

## WebSocket Message: AUTH_RESPONSE
Sent from Frontend (User) to Backend (Butler Gate) to approve or reject an action.

```json
{
  "type": "AUTH_RESPONSE",
  "target_id": 999, // Butler ID
  "payload": {
    "action_id": "uuid-v4-string",
    "approved": true,
    "feedback": "Proceed immediately."
  }
}
```
