# EchoCenter API Tests

This folder contains local integration probes for the mock environment.

Current flow:

- login as admin through the backend API
- fetch the Butler identity
- connect to WebSocket with the admin JWT
- send a direct Butler prompt
- auto-approve `AUTH_REQUEST` when Butler delegates a command
- wait for stream output, final reply, and recent OpenHands task status

Quick start:

```bash
make run-mock
python3 test/test_openhands_code_exec.py
```

Override the default prompt:

```bash
python3 test/test_openhands_code_exec.py "请调用 OpenHands Ops Agent，写一段 Python 代码计算 1 到 10 的平方和，执行后把代码和结果返回给我。"
```
