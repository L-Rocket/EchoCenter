# Chat Workspace Redesign Spec

## Goal

Rebuild the chat experience around a ChatGPT-style workspace:

- left rail: conversation history
- main pane: full-width markdown conversation
- no centered boxed chat column
- Butler-to-Agent runtime/monitor view in its own side rail
- Butler replies rendered as markdown blocks instead of speech bubbles
- user-to-agent conversations follow the same workspace pattern

This redesign must also support multiple saved conversations per peer, which requires a backend and data-model upgrade.

## Product Intent

The current UI is channel-first:

- one Butler channel
- one direct chat per agent
- message history keyed only by peer id

The target UI is workspace-first:

- a user can have multiple conversations with Butler
- a user can have multiple conversations with the same agent
- each conversation has its own title, message history, and lifecycle
- runtime execution and Butler-agent coordination become inspectable side context, not mixed into the main message stream

## Desired UX

### Main layout

1. Global left rail
- `Butler`
- `Agents`
- `Operations`
- `Settings`

2. Local workspace rail inside chat pages
- conversation list
- new conversation button
- search
- pinned/recent threads

3. Main conversation pane
- full-width content area
- markdown rendering
- no chat bubbles for Butler assistant replies
- user messages can stay visually compact and right-aligned, but the overall layout should feel document-like rather than messenger-like

4. Context rail
- for Butler page: Butler-to-Agent monitor / execution state / approvals / OpenHands trace
- for Agent page: agent runtime status / connection / recent system events

### Butler page

- left: Butler conversation sessions
- center: current Butler conversation
- right: Butler runtime context
  - approval state
  - OpenHands execution panel
  - Butler-to-Agent monitor

### Agents page

- left: agent picker and conversations under selected agent
- center: current user-to-agent conversation
- right: agent metadata and runtime status

## Why the backend must change

Today chat history is stored as a direct pair:

- `chat_messages(sender_id, receiver_id, ...)`

This is not enough for multi-conversation support because all messages between the same two users collapse into one timeline.

To support multiple conversations, we need a first-class conversation entity.

## Decision

Adopt a thread-based model:

- `conversation_threads`
- `chat_messages.conversation_id`

Direct user<->peer history becomes one or many threads, instead of a single implicit pair channel.

## Scope

### In scope

- multi-conversation data model
- Butler workspace redesign
- Agent workspace redesign
- markdown rendering in assistant output
- full-width conversation canvas
- separate runtime rail for Butler execution context
- Butler-to-Agent monitor moved out of the main chat stream
- test coverage for thread creation, listing, message retrieval, and UI regression

### Out of scope for phase 1

- conversation sharing
- conversation folders/tags
- collaborative multi-user threads
- server-side search over message bodies
- persistent streaming event log storage for every token

## Delivery Phases

### Phase 1: Data model and API foundation

- add thread model
- migrate existing pairwise chat history into default threads
- expose thread APIs
- keep existing `/api/chat/history/:peer_id` temporarily as compatibility shim

### Phase 2: Butler workspace UI

- left conversation rail
- full-width markdown conversation pane
- runtime rail with OpenHands / approvals / monitor

### Phase 3: Agent workspace UI

- agent picker + thread list
- same conversation surface as Butler
- right-side runtime/details panel

### Phase 4: Cleanup

- remove old single-channel assumptions from store and pages
- remove compatibility-only UI paths
- tighten regression tests

## Risks

### Data migration risk

Existing messages have no conversation id. Migration must assign a stable default thread per `(sender_id, receiver_id)` pair.

### Butler runtime coupling

Butler runtime currently uses in-memory session ids like `user_<id>`. Multi-thread support means Butler runtime session ids should become thread-aware:

- `user_<user_id>_thread_<thread_id>`

Otherwise different Butler conversations would share the same compaction state and memory summary.

### Frontend state complexity

The Zustand store is keyed by peer id today. It must become:

- thread-centric for messages
- peer-centric only for discovery/indexing

## Acceptance Criteria

1. A user can create multiple Butler conversations and switch between them without cross-contaminated history.
2. A user can create multiple conversations with the same agent.
3. Butler replies render markdown in a document-style pane.
4. OpenHands execution remains visible during long-running operations without blocking the conversation pane.
5. Existing seeded data continues to appear in a default migrated thread.
