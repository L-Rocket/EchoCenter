# 认证

## 概述

EchoCenter 使用 JWT (JSON Web Token) 进行用户认证。用户登录后会获得一个令牌，后续请求需要在 `Authorization` 头中携带该令牌。

## 登录流程

### 请求

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 响应

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MDAwMDAwMDB9.abc123"
}
```

### 令牌结构

JWT 令牌包含以下声明：
- `user_id` - 用户 ID
- `exp` - 过期时间

## 令牌验证

### 请求头

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MDAwMDAwMDB9.abc123
```

### 验证流程

1. 从请求头中提取令牌
2. 验证令牌签名
3. 检查令牌是否过期
4. 解析用户 ID
5. 将用户 ID 添加到上下文

## 中间件

### Auth 中间件

验证用户是否登录：

```go
func Auth(authSvc auth.Service) gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.Query("token")
        if token == "" {
            token = c.GetHeader("Authorization")
        }
        
        userID, err := authSvc.ValidateToken(token)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }
        
        c.Set("user_id", userID)
        c.Next()
    }
}
```

### AdminOnly 中间件

验证用户是否为管理员：

```go
func AdminOnly(authSvc auth.Service) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID, _ := c.Get("user_id")
        user, err := repo.GetUserByID(c, userID.(int))
        if err != nil || user.Role != "admin" {
            c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
            return
        }
        
        c.Next()
    }
}
```

## 令牌管理

### 令牌过期

默认令牌过期时间为 24 小时。可以通过环境变量配置：

```env
JWT_EXPIRES_IN=24h
```

### 令牌刷新

当前版本不支持令牌刷新。过期后需要重新登录。

### 令牌撤销

当前版本不支持令牌撤销。可以通过修改 JWT 密钥来使所有令牌失效。

## 安全性

### 密钥管理

JWT 密钥应该足够长且随机。可以通过环境变量配置：

```env
JWT_SECRET=your_jwt_secret_here_at_least_32_characters_long
```

### HTTPS

生产环境应该使用 HTTPS 来保护令牌传输。

### 存储

前端应该安全地存储令牌：
- 使用 HTTP-only cookies
- 或者 localStorage（不推荐）

### 跨域

CORS 配置应该限制允许的源：

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 错误处理

### 无效令牌

```json
{
  "error": "invalid token"
}
```

### 令牌过期

```json
{
  "error": "token expired"
}
```

### 未授权

```json
{
  "error": "unauthorized"
}
```

### 禁止访问

```json
{
  "error": "forbidden"
}
```

## 最佳实践

1. **使用 HTTPS** - 保护令牌传输
2. **设置合理的过期时间** - 避免令牌长期有效
3. **安全存储令牌** - 使用 HTTP-only cookies
4. **限制 CORS** - 只允许必要的源
5. **定期轮换密钥** - 定期更换 JWT 密钥
6. **监控令牌使用** - 监控异常的令牌使用

## 示例

### cURL 示例

```bash
# 登录
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 使用令牌访问受保护的端点
curl -X GET http://localhost:8080/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### JavaScript 示例

```javascript
// 登录
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});

const { token } = await response.json();

// 使用令牌
const messages = await fetch('/api/messages', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const data = await messages.json();
```

### Go 示例

```go
// 登录
resp, err := http.Post("/api/auth/login", "application/json", body)
var result struct {
    Token string `json:"token"`
}
json.NewDecoder(resp.Body).Decode(&result)

// 使用令牌
req, _ := http.NewRequest("GET", "/api/messages", nil)
req.Header.Set("Authorization", "Bearer "+result.Token)
resp, err := http.DefaultClient.Do(req)
```
