# SQLite vs PostgreSQL（LLM Mock 压测记录）

> 本文档记录了 EchoCenter 在 `MOCK_MODE` 场景下的数据库对比结果。  
> 对应压测工具链位于分支：`chore/mock-llm-loadtest`。

## 测试入口

```bash
git checkout chore/mock-llm-loadtest
make stress-llm
```

## 统一参数

- `STRESS_REQUESTS=1000`
- `STRESS_CONCURRENCY=20`
- `STRESS_TIMEOUT=20s`
- LLM mock 延迟：`800ms`

## 结果摘要

### SQLite
- `throughput=24.31 req/s`
- `p50=811.633ms`, `p95=869.437ms`, `p99=876.736ms`
- 日志出现大量 `SQLITE_BUSY` 与持久化失败

### 本地 PostgreSQL
- `throughput=24.34 req/s`
- `p50=815.569ms`, `p95=858.189ms`, `p99=872.169ms`
- 未出现对应 DB 锁冲突与持久化失败

## 结论

- 在该场景下，吞吐和延迟几乎都被 LLM mock 的 `800ms` 主导，SQLite 与 PostgreSQL 的性能数值接近。
- 但稳定性差异明显：SQLite 在高并发写入下更容易出现锁冲突，PostgreSQL 更稳定。
- 建议：压测与生产都优先 PostgreSQL；SQLite 仅适合轻量/本地开发场景。
