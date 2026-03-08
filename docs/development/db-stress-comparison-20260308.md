# SQLite vs PostgreSQL (LLM Mock Stress Comparison)

This page summarizes the LLM mock stress test comparison for EchoCenter.

The stress tooling itself is maintained in branch:

- `chore/mock-llm-loadtest`

Run command:

```bash
git checkout chore/mock-llm-loadtest
make stress-llm
```

## Test Profile

- `STRESS_REQUESTS=1000`
- `STRESS_CONCURRENCY=20`
- `STRESS_TIMEOUT=20s`
- `MOCK_MODE` LLM delay: `800ms`

## Summary

### SQLite
- `throughput=24.31 req/s`
- `p50=811.6ms`, `p95=869.4ms`, `p99=876.7ms`
- Under concurrent writes, logs showed many `SQLITE_BUSY` and persist-failure signals.

### Local PostgreSQL
- `throughput=24.34 req/s`
- `p50=815.6ms`, `p95=858.2ms`, `p99=872.2ms`
- No corresponding DB lock/persist-failure signals in this run.

## Conclusion

- In this mock setup, latency/throughput are both dominated by the 800ms LLM delay, so raw performance is close.
- Reliability under concurrent writes is better with PostgreSQL.
- Recommendation: prefer PostgreSQL for stress/production paths, use SQLite mainly for lightweight local development.
