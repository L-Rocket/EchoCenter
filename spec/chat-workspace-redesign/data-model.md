# Data Model and API Plan

## Current State

### Database

Current persistent chat model:

- table: `chat_messages`
- fields:
  - `sender_id`
  - `receiver_id`
  - `type`
  - `content`
  - `timestamp`

There is no thread table and no conversation identifier.

### Frontend state

Current message cache:

- `messages: Record<number, ChatMessage[]>`

Keyed by peer id, which means only one timeline per peer.

## Target State

### New table: `conversation_threads`

Proposed fields:

- `id`
- `owner_user_id`
- `peer_user_id`
- `channel_kind`
  - `butler_direct`
  - `agent_direct`
  - `butler_agent_monitor`
- `title`
- `summary`
- `is_pinned`
- `archived_at`
- `last_message_at`
- `created_at`
- `updated_at`

Notes:

- `owner_user_id` is the human/admin user owning the workspace thread
- `peer_user_id` is Butler or an agent
- `channel_kind` keeps Butler direct threads separate from runtime/monitor threads

### Change table: `chat_messages`

Add:

- `conversation_id`

Keep:

- `sender_id`
- `receiver_id`
- `type`
- `content`
- `timestamp`

This preserves compatibility while enabling thread-level retrieval.

## Migration Strategy

### Migration 1

Create `conversation_threads`.

### Migration 2

Add nullable `conversation_id` to `chat_messages`.

### Migration 3

Backfill existing messages:

- group by `(sender_id, receiver_id)` pair normalized to owner/peer semantics for direct user threads
- create one default thread per distinct direct pair
- assign `chat_messages.conversation_id`

### Migration 4

Set `conversation_id` to non-null for supported message kinds after backfill.

## Butler Runtime Session Change

Current Butler runtime session key:

- `user_<user_id>`

Target key:

- `user_<user_id>_thread_<thread_id>`

Reason:

- context compaction
- rolling summary
- pending async compaction

must be isolated per conversation thread.

## API Plan

### New endpoints

#### `GET /api/chat/threads`

Query:

- `peer_id`
- `channel_kind`

Returns thread list for current user.

#### `POST /api/chat/threads`

Creates a new thread.

Body:

- `peer_id`
- `channel_kind`
- `title?`

#### `PATCH /api/chat/threads/:thread_id`

Updates:

- title
- pin state
- archive state

#### `GET /api/chat/threads/:thread_id/messages`

Returns messages for one thread.

#### `POST /api/chat/threads/:thread_id/messages`

Optional REST fallback for tests; websocket remains primary send path.

### WebSocket change

Outgoing/incoming chat payloads should support:

- `conversation_id`

The server should route and persist against the specified thread id.

Compatibility rule:

- if `conversation_id` is missing, fall back to the legacy implicit default thread for that peer

## Frontend Store Plan

### Replace

- `messages: Record<number, ChatMessage[]>`

### With

- `messagesByThread: Record<number, ChatMessage[]>`
- `threadsByPeer: Record<number, ConversationThread[]>`
- `activeThreadByPeer: Record<number, number | null>`

This keeps routing and rendering simple.

## Runtime/Monitor Modeling

Butler-to-Agent execution history should not pollute direct Butler chat threads.

Recommended treatment:

- direct user<->Butler threads use `channel_kind = butler_direct`
- Butler<->Agent monitor data stays separate:
  - either virtual monitor feed
  - or dedicated `channel_kind = butler_agent_monitor`

Phase 1 recommendation:

- keep monitor API separate
- do not persist monitor entries into user conversation threads

## OpenHands Execution Visibility

No schema change is strictly required for phase 1 UI.

Current source:

- `/api/users/ops/tasks`

can power:

- runtime rail
- execution panel
- task playback

Future optional enhancement:

- add `thread_id` to `OpenHandsTaskRecord` persistence if tasks need exact per-thread correlation in database.
