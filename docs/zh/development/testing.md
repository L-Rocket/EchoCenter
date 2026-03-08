# 测试指南

## 概述

本指南介绍如何测试 EchoCenter。

## 单元测试

### 后端测试

```bash
cd backend
go test ./...
```

### 前端测试

```bash
cd frontend
npm test
```

## 集成测试

### 启动服务

```bash
make run-mock RESET=1
```

### 测试 API

#### 登录

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

#### 获取消息

```bash
curl -X GET http://localhost:8080/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 注册代理

```bash
curl -X POST http://localhost:8080/api/users/agents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"Test-Agent"}'
```

### 测试 WebSocket

#### 连接

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

## 手动测试

### 测试流程

1. **启动服务**

```bash
make run-mock RESET=1
```

2. **登录**

访问 `http://localhost:5173`，使用以下凭据登录：
- 用户名：`admin`
- 密码：`admin123`

3. **测试消息**

- 发送消息给 Butler
- 查看响应
- 测试命令执行

4. **测试代理**

- 查看代理列表
- 查看代理状态
- 测试代理通信

### 测试用例

#### 1. 用户登录

```gherkin
Given I am on the login page
When I enter valid credentials
Then I should be logged in successfully
```

#### 2. 发送消息

```gherkin
Given I am logged in
When I send a message to Butler
Then I should receive a response
```

#### 3. 命令执行

```gherkin
Given I am logged in
When I request a command execution
Then I should receive an authorization request
When I approve the request
Then the command should be executed
And I should see the result
```

#### 4. 代理注册

```gherkin
Given I am logged in as admin
When I register a new agent
Then the agent should be registered
And I should see it in the agent list
```

## 自动化测试

### 后端测试

#### 测试登录

```go
func TestLogin(t *testing.T) {
    // 创建测试服务器
    // 发送登录请求
    // 验证响应
}
```

#### 测试消息处理

```go
func TestHandleUserMessage(t *testing.T) {
    // 创建测试消息
    // 调用处理函数
    // 验证结果
}
```

### 前端测试

#### 测试登录

```javascript
it('should login successfully', () => {
  cy.visit('/login');
  cy.get('#username').type('admin');
  cy.get('#password').type('admin123');
  cy.get('button').click();
  cy.url().should('include', '/dashboard');
});
```

#### 测试消息发送

```javascript
it('should send message', () => {
  cy.visit('/chat');
  cy.get('#message-input').type('Hello');
  cy.get('#send-button').click();
  cy.contains('Hello');
});
```

## 性能测试

### LLM Mock 压测（专用分支）

`main` 分支保留基础运行与测试说明，LLM 压测工具链维护在：

- `chore/mock-llm-loadtest`

如需使用 `MOCK_MODE` 与 `make stress-llm`，请切换到该分支执行：

```bash
git checkout chore/mock-llm-loadtest
make stress-llm
```

对比结果与结论模板参考：

- `docs/zh/development/db-stress-comparison-20260308.md`

### 后端性能测试

```bash
# 使用 wrk
wrk -t4 -c100 -d30s http://localhost:8080/api/ping

# 使用 ab
ab -n 1000 -c 100 http://localhost:8080/api/ping
```

### 前端性能测试

```bash
# 使用 Lighthouse
lighthouse http://localhost:5173 --view
```

## 故障排除

### 测试失败

检查：
1. 测试环境是否正确
2. 测试数据是否正确
3. 测试代码是否正确

### 性能问题

检查：
1. 数据库查询是否优化
2. WebSocket 连接是否过多
3. 代码是否有性能瓶颈

## 最佳实践

### 1. 测试覆盖率

确保测试覆盖所有关键功能。

### 2. 自动化测试

将测试集成到 CI/CD 流程中。

### 3. 性能测试

定期进行性能测试。

### 4. 安全测试

定期进行安全测试。

## 下一步

- [贡献指南](./contributing.md)
