# Quickstart: Dashboard Filtering and Search

## Verification Steps

### 1. Test Debounced Search
1. Type `scanning` into the search box.
2. Observe that the API request is only sent once you stop typing.
3. **Expectation**: Logs containing "scanning" appear.

### 2. Test Multi-dimensional Filter
1. Select `ERROR` in the Level filter.
2. Select `Security-Audit-Bot` in the Agent filter.
3. **Expectation**: Only error logs from that specific agent are displayed.

### 3. Test Pagination (Load More)
1. Ensure the database has > 50 messages.
2. Scroll to the bottom of the Dashboard.
3. Click `Load More`.
4. **Expectation**: 50 older messages are appended to the list without clearing the first 50.
