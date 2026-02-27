# Data Model: Dashboard Filtering and Search

## Frontend State: LogFilterState
Manages the current state of the dashboard views.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | string | Currently selected agent name for filtering. |
| `level` | string | Currently selected severity level (INFO/WARNING/ERROR). |
| `searchQuery` | string | Keyword from the search input. |
| `offset` | number | Current pagination offset. |
| `hasMore` | boolean | Indicates if more records are available in the backend. |

## Backend Query Params
(Mapped from `LogFilterState` to API request)
- Reuses existing `models.Message` struct for responses.
