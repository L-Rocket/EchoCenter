# Tasks: Butler 模型运行时动态切换

## Phase 1: 后端基础层

- [x] 1.1 `backend/internal/models/models.go` — 新增 `ButlerRuntimeConfig` struct（ModelName/BaseURL/APIToken/UpdatedByID/UpdatedAt 字段）
- [x] 1.2 `backend/internal/repository/repository.go` — 新增 `ButlerConfigRepository` interface；并入 `Repository` composite interface
- [x] 1.3 `backend/internal/repository/migrations.go` — 新增 migration `012_create_butler_runtime_config`（SQLite + PostgreSQL 双方言）
- [x] 1.4 `backend/internal/repository/butler_config_store.go` — 新增文件，实现 `GetButlerRuntimeConfig`、`UpsertButlerRuntimeConfig`、`DeleteButlerRuntimeConfig`
- [x] 1.5 `backend/internal/butler/service.go` — 新增 `UpdateModelConfig()`；修改 `InitButler()` 优先读 DB 配置

## Phase 2: 后端 API 层

- [x] 2.1 `backend/internal/api/handler/butler_config.go` — 新增文件，4 个 handler 方法（GetButlerConfig/UpdateButlerConfig/ResetButlerConfig/TestButlerConnectivity）
- [x] 2.2 `backend/internal/api/router/router.go` — 注册 4 个新路由（/api/butler/config group，AdminOnly）

## Phase 3: 前端配置面板

- [x] 3.1 `frontend/v3/src/services/butlerConfigService.ts` — 新增文件，4 个 API 调用函数
- [x] 3.2 `frontend/v3/src/components/admin/ButlerConfigSettings.tsx` — 新增文件，Butler 配置面板 UI 组件
- [x] 3.3 `frontend/v3/src/pages/SettingsPage.tsx` — 新增 butler 导航项和面板渲染
