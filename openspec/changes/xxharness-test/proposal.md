# xxharness-test

## 背景

EchoCenter 的核心 AI 助手 Butler 当前通过三个环境变量（BUTLER_BASE_URL、BUTLER_API_TOKEN、BUTLER_MODEL）在服务启动时一次性完成初始化，运行期间不可变更。需要切换模型时必须重启服务，影响所有在线用户。

## 变更动机

- Admin 可在 Web 界面无重启切换 Butler 所使用的 LLM 模型和凭证
- 降低模型切换操作门槛，无需服务器访问权限
- 通过连通性测试提前验证配置有效性，减少错误配置导致的服务中断

## 变更范围

| 应用 | 变更类型 | 变更概述 |
|------|----------|----------|
| EchoCenter 后端 (Go/Gin) | 功能新增 | 新增 butler 配置读写 REST API + butler 服务热更新能力 |
| EchoCenter 前端 v3 (React/TS) | 功能新增 | SettingsPage 新增 Butler 模型配置区块 |

## 超出范围

- 非 Admin 用户访问或修改配置
- 按会话/按用户设置不同模型
- 模型切换历史记录与审计日志
- 对正在进行中的消息实时中断
- API Token 加密存储（已知风险）
