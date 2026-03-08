# Testing Guide

## Overview

This guide describes how to test EchoCenter.

## Unit Testing

### Backend Testing
```bash
cd backend
go test ./...
```

### Frontend Testing
```bash
cd frontend
npm test
```

## Integration Testing

### Start Services
```bash
make run-mock RESET=1
```

### Test API

#### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### Get Messages
```bash
curl -X GET http://localhost:8080/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Register Agent
```bash
curl -X POST http://localhost:8080/api/users/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"Test-Agent"}'
```

### Test WebSocket

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080/api/ws?token=YOUR_TOKEN');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  console.log('Message:', event.data);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

## Manual Testing

### Testing Workflow

1. **Start Services**
```bash
make run-mock RESET=1
```

2. **Login**
Visit `http://localhost:5173`, use the following credentials to login:
- Username: `admin`
- Password: `admin123`

3. **Test Messages**
- Send a message to Butler.
- View the response.
- Test command execution.

4. **Test Agents**
- View agent list.
- View agent status.
- Test agent communication.

### Test Cases

#### 1. User Login
```gherkin
Given I am on the login page
When I enter valid credentials
Then I should be logged in successfully
```

#### 2. Send Message
```gherkin
Given I am logged in
When I send a message to Butler
Then I should receive a response
```

#### 3. Command Execution
```gherkin
Given I am logged in
When I request a command execution
Then I should receive an authorization request
When I approve the request
Then the command should be executed
And I should see the result
```

#### 4. Agent Registration
```gherkin
Given I am logged in as admin
When I register a new agent
Then the agent should be registered
And I should see it in the agent list
```

## Automated Testing

### Backend Testing

#### Test Login
```go
func TestLogin(t *testing.T) {
    // Create test server
    // Send login request
    // Validate response
}
```

#### Test Message Handling
```go
func TestHandleUserMessage(t *testing.T) {
    // Create test message
    // Call handler function
    // Validate result
}
```

### Frontend Testing

#### Test Login
```javascript
it('should login successfully', () => {
  cy.visit('/login');
  cy.get('#username').type('admin');
  cy.get('#password').type('admin123');
  cy.get('button').click();
  cy.url().should('include', '/dashboard');
});
```

#### Test Message Sending
```javascript
it('should send message', () => {
  cy.visit('/chat');
  cy.get('#message-input').type('Hello');
  cy.get('#send-button').click();
  cy.contains('Hello');
});
```

## Performance Testing

### LLM Mock Stress Test (Dedicated Branch)

The `main` branch keeps core runtime/testing docs, while LLM pressure tooling is maintained in:

- `chore/mock-llm-loadtest`

Use that branch when you need `MOCK_MODE` and `make stress-llm`:

```bash
git checkout chore/mock-llm-loadtest
make stress-llm
```

See comparison notes:

- `docs/zh/development/db-stress-comparison-20260308.md`

### WebSocket Long-Connection Capacity (C20K)

- Validation date: `2026-03-08`
- Verified profile: idle long-lived WebSocket connections (no business-message traffic), periodic Ping keepalive
- Verified result: `20,000 / 20,000` connections established and held (`100%`)
- Observed backend process during hold:
  - RSS around `401MB~415MB`
  - Threads around `29`
- Important:
  - This validates connection-carrying capacity for idle clients/agents.
  - It does **not** represent message throughput limits for heavy chat/business traffic.
- Tooling branch for executable stress code:
  - `git fetch origin`
  - `git checkout feat/ws-c10k-stress-test`

### Backend Performance Testing
```bash
# Using wrk
wrk -t4 -c100 -d30s http://localhost:8080/api/ping

# Using ab
ab -n 1000 -c 100 http://localhost:8080/api/ping
```

### Frontend Performance Testing
```bash
# Using Lighthouse
lighthouse http://localhost:5173 --view
```

## Troubleshooting

### Test Failed
Check:
1. Test environment is correct.
2. Test data is correct.
3. Test code is correct.

### Performance Issues
Check:
1. Database queries are optimized.
2. Too many WebSocket connections.
3. Code has performance bottlenecks.

## Best Practices
1. **Test Coverage**: Ensure tests cover all key functions.
2. **Automated Testing**: Integrate tests into the CI/CD pipeline.
3. **Performance Testing**: Perform performance testing regularly.
4. **Security Testing**: Perform security testing regularly.

## Next Steps
- [Contributing Guide](./contributing.md)
