# Feature Specification: Agent Butler Coordination (my-agent)

**Feature Branch**: `009-agent-butler-coordination`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "你看到这个 my agent 了吗，他应该作为这个 echocenter 的管家，他有权限接受所有其他的 agent 的消息，但是没有用户授权没有权限和其他agent 沟通。当管家需要指挥其他 agent 的时候，他需要向用户请求权限。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Centralized Butler Visibility (Priority: P1)

As an EchoCenter operator, I want the Butler agent (my-agent) to automatically receive all logs and status updates from every other agent in the system so that it has full situational awareness to assist me.

**Why this priority**: Foundational capability. The Butler cannot "manage" the hive if it cannot see what's happening.

**Independent Test**: Trigger a log from "Weather-Sentinel". Verify that the Butler's internal state (logged in backend) or "thoughts" (if visible) reflects this message.

**Acceptance Scenarios**:

1. **Given** a message is ingested from any Sub-Agent, **When** the message is processed by the Hub, **Then** a copy is routed to the Butler's Eino logic.

---

### User Story 2 - Human-in-the-Loop Command Authorization (Priority: P1)

As an operator, I want the Butler to request my explicit permission before it sends any command or message to another agent, so that I maintain ultimate control over the autonomous swarm.

**Why this priority**: Core safety requirement. Prevents unauthorized or unintended agent-to-agent interactions.

**Independent Test**: Use the Butler UI to "propose" a command to another agent. Verify that NO message is sent to the target agent until the "Approve" button is clicked in the UI.

**Acceptance Scenarios**:

1. **Given** the Butler identifies a need to command "Agent B", **When** the Butler triggers a "Command" tool, **Then** the system generates an `AUTH_REQUEST` and notifies the user.
2. **Given** a pending `AUTH_REQUEST`, **When** the user clicks "Approve", **Then** and only then is the command delivered to "Agent B".
3. **Given** a pending `AUTH_REQUEST`, **When** the user clicks "Reject", **Then** the command is discarded and the Butler is notified of the rejection.

---

### User Story 3 - Interactive Authorization UI (Priority: P2)

As an operator, I want to see Butler's authorization requests as interactive cards in the chat interface so that I can quickly understand the context and make a decision without leaving the conversation.

**Why this priority**: Crucial for UX and efficient management.

**Independent Test**: Verify that the chat window for "my-agent" renders a special UI component (card) when an authorization is requested.

---

### Edge Cases

- **Butler Timeout**: What happens if the user doesn't respond to an auth request? (Assume: request stays pending indefinitely or expires after a safe period).
- **Multiple Pending Actions**: Can the Butler request multiple authorizations simultaneously? (Yes, each must have a unique ID).
- **Sub-Agent Offline**: What happens if an authorized command is sent but the target agent is disconnected? (Standard WebSocket delivery failure handling).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Backend MUST identify `my-agent` as the **System Butler** with global ingestion privileges.
- **FR-002**: System MUST use the **Eino framework** to orchestrate the Butler's logic and tool-calling loop.
- **FR-003**: System MUST implement a **Command Gate** (HITL Interceptor) that pauses Eino tool execution for agent-bound commands.
- **FR-004**: System MUST support a new WebSocket message type `AUTH_REQUEST` (Butler -> User) and `AUTH_RESPONSE` (User -> Butler).
- **FR-005**: Frontend MUST implement a **Request Card** component in the chat view to render the "Approve/Reject" interface.
- **FR-006**: Backend MUST persist the state of pending authorizations to handle server restarts or page refreshes.

### Key Entities *(include if feature involves data)*

- **Authorization Request**:
    - `id`: Unique identifier for the action.
    - `butler_id`: ID of the requesting Butler.
    - `target_id`: ID of the agent to receive the command.
    - `command_payload`: The content/action to be executed.
    - `reasoning`: Butler's explanation for the action.
    - `status`: PENDING, APPROVED, REJECTED, EXPIRED.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero messages are sent from Butler to other agents without a corresponding "APPROVED" record in the database.
- **SC-002**: Butler receives 100% of messages broadcasted via the `SYSTEM_LOG` channel.
- **SC-003**: The UI updates the status of an authorization request within 200ms of user interaction.
- **SC-004**: System successfully recovers pending authorization states after a full backend restart.

## Assumptions

- **A-001**: `my-agent` has a fixed, known ID or is identified by a specific role in the `users` table.
- **A-002**: The Eino framework is compatible with the existing Go/Gin/Websocket stack.
- **A-003**: The operator is the only human user authorized to approve Butler requests (Single-admin model for now).
