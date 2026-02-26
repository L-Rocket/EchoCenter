# API Contracts: Chat History Persistence

## GET /api/chat/history/:peer_id
Retrieves the most recent chat messages between the current user and a peer (Agent or Human).

### Auth
- **Required**: Bearer Token (JWT).

### Query Parameters
- `limit` (optional): Default 50.

### Responses
- **200 OK**: List of messages in chronological order.
  ```json
  [
    {
      "id": 101,
      "sender_id": 1,
      "receiver_id": 42,
      "content": "Status update requested.",
      "timestamp": "2026-02-25T14:00:00Z"
    },
    {
      "id": 102,
      "sender_id": 42,
      "receiver_id": 1,
      "content": "System nominal. All sensors active.",
      "timestamp": "2026-02-25T14:05:00Z"
    }
  ]
  ```
- **401 Unauthorized**: Missing or invalid token.
- **404 Not Found**: Peer ID does not exist.
