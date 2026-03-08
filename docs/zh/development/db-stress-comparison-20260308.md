# SQLite vs PostgreSQL（本地容器）压测对比（2026-03-08）

## 1) 测试目标
- 在相同代码、相同负载下，对比 `SQLite` 与 `本地 PostgreSQL`。
- 验证“本地 PG”下是否仍有明显劣化，排除远程网络干扰。

## 2) 统一条件
- 压测入口：`make stress-llm`
- LLM：`MOCK_MODE=true`（固定 `sleep 800ms`）
- 压测接口：`POST /api/dev/mock/butler-chat`
- 负载参数：`STRESS_REQUESTS=1000`，`STRESS_CONCURRENCY=20`，`STRESS_TIMEOUT=20s`

SQLite：
```bash
STRESS_REQUESTS=1000 STRESS_CONCURRENCY=20 STRESS_TIMEOUT=20s make stress-llm
```

本地 PostgreSQL（容器）：
```bash
DB_DRIVER=postgres \
DB_DSN='postgres://admin:e.1415926pi@localhost:25432/echocenter?sslmode=disable' \
STRESS_REQUESTS=1000 STRESS_CONCURRENCY=20 STRESS_TIMEOUT=20s \
make stress-llm
```

## 3) 实测结果

### SQLite
- 结果文件：`backend/logs/stress-llm-result-20260308-163120.log`
- `success=1000/1000`
- `throughput=24.31 req/s`
- `latency`: `p50=811.633ms`, `p95=869.437ms`, `p99=876.736ms`, `avg=822.446ms`
- 日志计数：`SQLITE_BUSY=1858`，`save_fail=1436`，`broadcast queue full=0`

### 本地 PostgreSQL
- 结果文件：`backend/logs/stress-llm-result-20260308-163216.log`
- `success=1000/1000`
- `throughput=24.34 req/s`
- `latency`: `p50=815.569ms`, `p95=858.189ms`, `p99=872.169ms`, `avg=821.233ms`
- 日志计数：`SQLITE_BUSY=0`，`save_fail=0`，`broadcast queue full=0`

## 4) 对比结论
- 在“本地部署、同负载、无额外网络 RTT”条件下，**两者吞吐和延迟几乎一致**（都被 800ms mock LLM 主导）。
- 但稳定性上差异明显：  
  - `SQLite` 出现大量写锁冲突（`SQLITE_BUSY`）和落库失败日志。  
  - `PostgreSQL` 没有出现对应落库失败。
- 因此在你的后端并发场景中，**若要保证聊天持久化可靠性，PostgreSQL 明显优于 SQLite**；性能不会比 SQLite 差，但一致性风险更低。
