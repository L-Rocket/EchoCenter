# Feature Specification: Chat History Persistence

**Feature Branch**: `007-chat-history-persistence`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "现在要支持在 agent 的聊天界面能显示历史聊天记录功能"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contextual Conversation Recovery (Priority: P1)

As an EchoCenter operator, I want to see the previous messages exchanged with an agent when I open their chat view so that I can maintain the context of our ongoing work.

**Why this priority**: Essential for meaningful multi-turn interactions. Without history, every refresh or page navigation forces the user to start from scratch.

**Independent Test**: Can be tested by sending messages to an agent, refreshing the browser, navigating to the "Agents" tab, and selecting the same agent. The previous messages must reappear.

**Acceptance Scenarios**:

1. **Given** I have a previous chat history with "Agent A", **When** I click "Chat" for "Agent A", **Then** the last 50 messages are fetched from the backend and displayed in chronological order.
2. **Given** a new agent with no history, **When** I open their chat, **Then** I see the "Awaiting Transmission" empty state.

---

### User Story 2 - Automated Message Archiving (Priority: P1)

As a system, I want all bi-directional messages sent via WebSockets to be automatically stored in the database so that no conversation data is lost during system restarts.

**Why this priority**: Foundation for persistence. If the backend doesn't save the data, the frontend cannot recover it.

**Independent Test**: Send a message via the UI, then inspect the database directly or via a backend API to confirm the message exists in the `chat_messages` table.

**Acceptance Scenarios**:

1. **Given** an active WebSocket session, **When** a user sends a 'CHAT' type message, **Then** the backend writes that message to the database before or during broadcast.
2. **Given** an active WebSocket session, **When** an agent sends a 'CHAT' type response, **Then** the backend writes that response to the database.

---

### User Story 3 - On-Demand History Loading (Priority: P2)

As a user, I want the system to only load chat history when I actually select an agent, so that the initial application load and the sidebar navigation remain fast and lightweight.

**Why this priority**: Performance optimization. Pre-loading history for all agents would be inefficient as the agent hive grows.

**Independent Test**: Monitor the "Network" tab in browser dev tools and verify that the `/api/chat/history` request is only triggered when an agent is selected.

---

### Edge Cases

- **Large History**: How does the system handle agents with thousands of messages? (Default: Limit to the most recent 50 for MVP).
- **Deleted Agents**: If an agent is deleted, their history should be cleaned up or orphaned gracefully.
- **Message Integrity**: Ensuring that sender and receiver IDs are correctly mapped even if the user logs out and back in.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Backend MUST implement a `chat_messages` table in the database.
- **FR-002**: Backend MUST persist all messages of type `CHAT` exchanged via the WebSocket Hub.
- **FR-003**: Backend MUST provide a REST API endpoint `GET /api/chat/history/:peer_id` that returns the most recent 50 messages between the current user and the specified peer.
- **FR-004**: Frontend MUST call the history API immediately upon selecting an agent in the `AgentsPage`.
- **FR-005**: Frontend MUST merge historical messages with the volatile session state in `useChatStore` without duplicating entries.
- **FR-006**: System MUST ensure that `SYSTEM_LOG` messages are NOT persisted in the `chat_messages` table (they remain volatile or use the existing ingestion log flow).

### Key Entities *(include if feature involves data)*

- **ChatMessage (Database)**:
    - `id`: INTEGER PRIMARY KEY.
    - `sender_id`: INTEGER (References Users table).
    - `receiver_id`: INTEGER (References Users table).
    - `content`: TEXT.
    - `timestamp`: DATETIME.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Historical messages load and render in the `ChatView` within 300ms of agent selection.
- **SC-002**: 100% of successfully delivered WebSocket chat messages are persisted to the database.
- **SC-003**: History remains available and accurate after a full backend process restart.
- **SC-004**: No duplication of messages when receiving a new message while history is loading.

## Assumptions

- **A-001**: We will reuse the existing `User` and `Agent` IDs for message attribution.
- **A-002**: Sorting will be chronological (newest at the bottom of the chat view).
- **A-003**: Pagination (loading more than 50 messages) is out of scope for this MVP.
