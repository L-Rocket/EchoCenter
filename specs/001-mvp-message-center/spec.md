# Feature Specification: EchoCenter MVP

**Feature Branch**: `001-mvp-message-center`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "请为 EchoCenter 项目生成一份极简的 MVP 功能规格说明书 (Functional Spec)。 # 1. 项目定位 EchoCenter 是一个轻量级的消息流转中心与监控看板，专门用于接收和集中展示各种本地 AI Agent（智能体）的运行状态。 # 2. 核心功能闭环 MVP 阶段仅包含以下三个核心功能，严禁添加任何额外特性： - 消息接收 (Ingestion)：系统提供一个标准化的收信通道。任何外部 Agent 都可以向该通道发送状态汇报，汇报内容仅包含：Agent 身份标识、消息级别（常规、警告、错误）以及具体的文本内容。 - 数据持久化 (Storage)：系统接收到消息后，自动打上当前系统时间戳，并永久存储，确保消息不丢失。 - 实时看板 (Dashboard)：系统提供一个可视化的 Web 面板。该面板会自动、持续地拉取系统中最新产生的 50 条消息，并按时间倒序（最新的在最上面）展示给用户，方便用户一站式监控所有 Agent 的工作流。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Status Reporting (Priority: P1)

As a developer of a local AI Agent, I want to report the agent's current status (identity, level, and content) to a central system so that I can monitor its behavior without checking individual logs.

**Why this priority**: This is the foundation of the system. Without message ingestion, there is nothing to store or display.

**Independent Test**: Can be fully tested by sending a mock status report to the ingestion channel and verifying that the system accepts it.

**Acceptance Scenarios**:

1. **Given** the system is running, **When** an agent sends a report with ID, level, and content, **Then** the system returns a success confirmation.
2. **Given** an agent sends a report, **When** any required field (ID, level, or content) is missing, **Then** the system rejects the report with an error message.

---

### User Story 2 - Real-time Dashboard Monitoring (Priority: P2)

As a system operator, I want to view a web dashboard that automatically updates with the latest 50 messages from all agents so that I can see the real-time health of the entire agent swarm.

**Why this priority**: Provides the primary user interface and immediate value for monitoring.

**Independent Test**: Can be tested by opening the dashboard and observing that it displays the most recent 50 messages in the correct order.

**Acceptance Scenarios**:

1. **Given** there are multiple messages in the system, **When** the dashboard is loaded, **Then** it shows up to 50 of the newest messages.
2. **Given** the dashboard is open, **When** a new message is received by the system, **Then** the dashboard updates to include the new message at the top.
3. **Given** the dashboard shows 50 messages, **When** a new message arrives, **Then** the oldest message is removed from the view to maintain the 50-item limit.

---

### User Story 3 - Message Persistence (Priority: P3)

As a system operator, I want all agent reports to be permanently stored with a timestamp so that I have a reliable historical record for later analysis.

**Why this priority**: Ensures data integrity and prevents loss of information during system restarts or crashes.

**Independent Test**: Can be tested by ingesting messages, restarting the system, and verifying that the messages are still present in the storage.

**Acceptance Scenarios**:

1. **Given** a message is received, **When** it is stored, **Then** it must include an accurate system timestamp.
2. **Given** messages have been stored, **When** the system is restarted, **Then** all previously stored messages remain available for the dashboard.

---

### Edge Cases

- **Message Flood**: How does the system handle hundreds of messages arriving simultaneously?
- **Invalid Data Types**: What happens if an agent sends non-text content in the message field?
- **Network Interruptions**: How should the system respond if the storage becomes temporarily unavailable?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a standardized endpoint/channel for receiving agent status reports.
- **FR-002**: Ingestion reports MUST contain three specific fields: `Agent ID`, `Message Level` (Info, Warning, Error), and `Content`.
- **FR-003**: System MUST automatically assign a UTC timestamp to every message upon receipt.
- **FR-004**: System MUST store all received messages in a permanent, non-volatile storage.
- **FR-005**: System MUST provide a web-based user interface (Dashboard) accessible via a browser.
- **FR-006**: The Dashboard MUST display messages in reverse chronological order (newest first).
- **FR-007**: The Dashboard MUST limit the display to the 50 most recent messages.
- **FR-008**: The Dashboard SHOULD update its view automatically as new messages arrive.

### Key Entities *(include if feature involves data)*

- **Agent Message**: Represents a single status update from an agent.
  - `ID`: Unique identifier for the message (internal).
  - `AgentID`: Identification of the reporting agent.
  - `Level`: Severity level (Regular/Info, Warning, Error).
  - `Content`: The actual status text.
  - `Timestamp`: UTC time when the message was received.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of messages received by the ingestion channel are persisted with an accurate timestamp.
- **SC-002**: The Dashboard displays the latest 50 messages within 2 seconds of a page refresh.
- **SC-003**: New messages appear on the Dashboard within 5 seconds of being ingested by the system.
- **SC-004**: Users can differentiate between "Regular", "Warning", and "Error" messages visually on the Dashboard.

## Dependencies and Assumptions

### Assumptions
- **A-001**: AI Agents have reliable network access to the EchoCenter ingestion channel.
- **A-002**: Message content is predominantly text-based and within reasonable length limits (e.g., < 10KB).
- **A-003**: The system will run in a local environment where strict security (authentication) is not an immediate MVP requirement.

### Dependencies
- **D-001**: A modern web browser is required for viewing the Dashboard.
- **D-002**: The host system must provide stable persistent storage (file system or database).
