# Test Plan

## Backend

### Migration tests

1. migrating an existing database creates `conversation_threads`
2. existing `chat_messages` rows receive a default `conversation_id`
3. Butler messages and agent messages remain queryable after migration

### Repository tests

1. create thread
2. list threads by owner and peer
3. get messages by thread id
4. save message into a thread
5. legacy pair-history endpoint returns the default thread history

### Butler tests

1. two Butler threads for the same user maintain separate runtime session state
2. context compaction summary does not leak between threads
3. approvals still work when a message includes `conversation_id`

### API tests

1. create/list/update thread endpoints
2. thread-scoped history endpoint
3. websocket message with `conversation_id` persists to the correct thread

## Frontend

### Store tests

1. messages are keyed by thread id
2. switching threads does not overwrite another thread's message cache
3. stream chunks merge into the correct thread

### Component tests

1. Butler page renders:
  - left thread rail
  - center markdown conversation
  - right runtime rail
2. Agent page renders:
  - agent picker
  - thread list
  - full-width conversation pane
3. assistant markdown renders headings, lists, code blocks, and tables safely

### UX regression tests

Use Playwright for:

1. create a new Butler conversation
2. switch between two Butler conversations
3. approve an OpenHands action and verify runtime rail updates while waiting
4. create a new conversation with the same agent and verify separation
5. verify no centered boxed chat layout remains

## Manual Validation

1. `make install`
2. `make run-mock`
3. open Butler page
4. create two Butler conversations
5. send distinct prompts in each and verify isolated history
6. trigger OpenHands execution and observe runtime rail
7. switch to Agents page and verify same layout model

## Rollout Safety

Phase rollout should keep old endpoints working until the frontend fully migrates.

Recommended sequence:

1. migrations + repository + compatibility endpoints
2. frontend store update behind new pages
3. Butler page rollout
4. Agent page rollout
5. remove legacy single-channel assumptions
