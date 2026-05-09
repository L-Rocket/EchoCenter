# Design: Butler 模型运行时动态切换

## 架构

```
Admin 浏览器
    ├── GET /api/butler/config          ← 查看当前配置（API Token 脱敏）
    ├── PUT /api/butler/config          ← 保存新配置（持久化 + 热更新）
    ├── DELETE /api/butler/config       ← 清空 DB 配置，回退到 env vars
    └── POST /api/butler/config/test    ← 连通性测试（不写 DB）

后端 Gin Router（middleware.AdminOnly）
    └── handler.Handler（4 个新方法）
         ├── repository.Repository（新：ButlerConfigRepository）
         │     └── butler_runtime_config 表（SQLite / PostgreSQL）
         └── butler.GetButler().UpdateModelConfig()
               └── ButlerService（写锁保护，重建 EinoBrain + runtimeRouter）
```

## 数据模型

```go
type ButlerRuntimeConfig struct {
    ModelName   string    `db:"model_name"`
    BaseURL     string    `db:"base_url"`
    APIToken    string    `db:"api_token"`
    UpdatedByID int       `db:"updated_by_id"`
    UpdatedAt   time.Time `db:"updated_at"`
}
```

## 接口设计

| 路径 | 方法 | 中间件 | 说明 |
|------|------|--------|------|
| `/api/butler/config` | GET | Auth + AdminOnly | 查询当前配置 |
| `/api/butler/config` | PUT | Auth + AdminOnly | 更新配置（持久化 + 热更新） |
| `/api/butler/config` | DELETE | Auth + AdminOnly | 清空 DB 配置 |
| `/api/butler/config/test` | POST | Auth + AdminOnly | 连通性测试（不写 DB） |

## 热更新机制

```go
func (s *ButlerService) UpdateModelConfig(baseURL, apiToken, model string) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.baseURL = baseURL; s.apiToken = apiToken; s.model = model
    compactionCfg := loadContextCompactionConfig(baseURL, apiToken, model)
    routerCfg := loadRuntimeRouterConfig(baseURL, apiToken, model)
    s.brain = NewEinoBrain(baseURL, apiToken, model, compactionCfg)
    s.router = newRuntimeRouter(routerCfg.BaseURL, routerCfg.APIToken, routerCfg.Model, routerCfg)
}
```

## 启动加载优先级

DB 配置 > 环境变量。`InitButler` 在 `once.Do` 内先读 DB，回退到 env vars。

## 数据库

新增 migration 012：`butler_runtime_config` 表，`CHECK(id=1)` 强制单行约束，Upsert 幂等写。
