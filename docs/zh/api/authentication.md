---
outline: deep
---

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

```
{
  "user_id": 1,
  "exp": 1700000000
}
```

## 注册流程

### 请求

```
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password123"
}
```

### 响应

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJleHAiOjE3MDAwMDAwMDB9.def456"
}
```

## 令牌验证

### 中间件

```go
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "UNAUTHORIZED", Message: "Missing authorization header"}
            })
            c.Abort()
            return
        }

        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            return []byte(config.JWTSecret), nil
        })

        if err != !nil || !token.Valid {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "INVALID_TOKEN", Message: "Invalid token"}
            })
            c.Abort()
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.JSON(http.StatusUnauthorized, ErrorResponse{
                Error: Error{Code: "INVALID_TOKEN", Message: "Invalid token claims"}
            })
            c.Abort()
            return
        }

        userID := uint(claims["user_id"].(float64))
        c.Set("user_id", userID)
        c.Next()
    }
}
```

## API 端点

### 登录

```
POST /api/auth/login
```

**请求体**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应**
```json
{
  "token": "string"
}
```

### 注册

```
POST /api/auth/register
```

**请求体**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应**
```json
{
  "token": "string"
}
```

## 权限控制

### 角色

- `admin` - 管理员
- `user` - 普通用户

### 权限

- `admin` - 所有权限
- `user` - 有限权限

## 安全性

### 密码哈希

使用 Bcrypt 进行密码哈希：

```go
passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
```

### 令牌过期

令牌默认 24 小时过期：

```go
exp := time.Now().Add(time.Hour * 24).Unix()
```

## 配置要求

为了确保认证系统的安全性，必须配置以下环境变量：

- `JWT_SECRET` - **(强制要求)** 强随机密钥（至少 32 个字符）。如果缺失或长度不足，系统将无法启动。
- `JWT_TOKEN_EXPIRATION` - (可选) 令牌有效期 (例如 `24h`)。
- `BCRYPT_COST` - (可选) 密码哈希的计算成本 (默认 `12`)。

## CORS

配置 CORS 保护：

```go
app.Use(cors.New(cors.Config{
    AllowOrigins: []string{"http://localhost:3000"},
    AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
}))
```

## 错误处理

### 无效凭据

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid username or password"
  }
}
```

### 未授权

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing authorization header"
  }
}
```

### 无效令牌

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid token"
  }
}
```

## 前端集成

### 登录

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin123'
  })
})

const data = await response.json()
localStorage.setItem('token', data.token)
```

### 发送请求

```javascript
const token = localStorage.getItem('token')

const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

## 最佳实践

### 1. 令牌存储

- 使用 `localStorage` 或 `sessionStorage`
- 不要存储在 cookie 中（防止 CSRF）

### 2. 令牌刷新

- 令牌过期前刷新
- 使用 refresh token（未来）

### 3. 令牌撤销

- 登出时清除令牌
- 服务器端撤销令牌（未来）

### 4. 安全传输

- 使用 HTTPS
- 不要在 URL 中传递令牌
