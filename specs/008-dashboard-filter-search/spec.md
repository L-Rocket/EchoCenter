# Feature Specification: Dashboard Filtering and Search

**Feature Branch**: `008-dashboard-filter-search`  
**Created**: 2026-02-25  
**Status**: Draft  
**Input**: User description: "后端过滤，我倾向于 Debounce ， 需要加载更多的分页功能"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-dimensional Log Filtering (Priority: P1)

As an EchoCenter operator, I want to filter the system logs by Agent and Severity Level so that I can focus on critical errors or specific bot activities without scrolling through irrelevant data.

**Why this priority**: Essential for managing systems with many agents and high log volume.

**Independent Test**: Select "ERROR" from the level filter and verify that only red-labeled error logs are displayed. Select a specific Agent and verify only their logs appear.

**Acceptance Scenarios**:

1. **Given** I am on the Dashboard, **When** I select "Code-Reviewer-AI" from the agent filter, **Then** the list updates to show only logs from that agent.
2. **Given** a filtered list, **When** I click "Reset", **Then** all filters are cleared and the default view returns.

---

### User Story 2 - Real-time Debounced Search (Priority: P1)

As an operator, I want to search for keywords within log messages so that I can quickly find specific events or error codes.

**Why this priority**: Critical for troubleshooting specific issues.

**Independent Test**: Type "database" into the search box and verify that logs containing that word appear after a short pause, without needing to press Enter.

**Acceptance Scenarios**:

1. **Given** the search input, **When** I type "unauthorized", **Then** the system waits 500ms and then fetches matching logs from the backend.
2. **Given** a search term, **When** I clear the input, **Then** the full log list is restored.

---

### User Story 3 - Paginated History Recovery (Priority: P2)

As a user, I want to load more historical logs by clicking a button or scrolling, so that I can investigate past events beyond the initial 50 records.

**Why this priority**: Necessary for deep historical analysis.

**Independent Test**: Scroll to the bottom of the log list, click "Load More", and verify that 50 additional older logs are appended to the list.

**Acceptance Scenarios**:

1. **Given** I am at the end of the current log list, **When** I click "Load More", **Then** the system fetches the next page of logs from the backend and appends them.
2. **Given** no more logs exist in the database, **When** I reach the end, **Then** the "Load More" button is hidden or disabled.

---

### Edge Cases

- **No Results**: Show a clear "No matching logs found" state when filters/search return empty.
- **Network Latency**: Show a loading spinner within the list area while backend filtering is in progress.
- **Concurrent Filters**: Ensure that searching while an Agent filter is active correctly intersects both conditions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Backend MUST update `GET /api/messages` to support the following query parameters:
    - `agent_id`: Filter by agent name/ID.
    - `level`: Filter by severity (INFO, WARNING, ERROR).
    - `q`: Search keyword in message content.
    - `offset`: Starting index for pagination.
    - `limit`: Number of records to return (default 50).
- **FR-002**: Frontend MUST implement a **Filter Bar** at the top of the Dashboard.
- **FR-003**: Frontend MUST implement **Debounced Search** (delay of 500ms) for the keyword input.
- **FR-004**: Frontend MUST implement a "Load More" button at the bottom of the log list.
- **FR-005**: System MUST ensure that `SYSTEM_LOG` WebSocket updates are correctly integrated or ignored when a specific historical filter is active (Assume: real-time updates are paused or filtered if user is looking at historical data).

### Key Entities *(include if feature involves data)*

- **Log Filter Configuration**: Local state object containing current `agentId`, `level`, `searchQuery`, and `pageOffset`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Filtered results are returned from the backend in < 200ms.
- **SC-002**: Debounce logic reduces unnecessary API calls by at least 70% during active typing.
- **SC-003**: Log list remains performant (no lag) even when displaying 500+ records in the DOM.
- **SC-004**: Users can reach any log record in the database via the combination of filtering and pagination.

## Assumptions

- **A-001**: We will use `Shadcn/ui` Select, Input, and Button components for the Filter Bar.
- **A-002**: Backend will use SQL `LIKE %q%` for the content search.
