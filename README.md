# EchoCenter 🌐

<p align="center">
  <a href="https://l-rocket.github.io/EchoCenter/"><strong>Explore Documentation »</strong></a>
  <br />
  <br />
  <a href="https://github.com/L-Rocket/EchoCenter/issues">Report Bug</a>
  ·
  <a href="https://github.com/L-Rocket/EchoCenter/issues">Request Feature</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat-square&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React Version" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite" alt="Vite Version" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

[Documentation Site](https://l-rocket.github.io/EchoCenter/) | [中文 README](./README.zh.md)

**EchoCenter** is a professional, modular intelligent agent management hub. It provides a centralized platform for agent registration, real-time bidirectional messaging via WebSocket, and intelligent command execution coordinated by the core **Butler** agent.

## ✨ Key Features

- **🤖 Multi-Agent Fleet**: Seamlessly manage and coordinate diverse AI agents (Python, Go, etc.).
- **⚡ Real-time Messaging**: Low-latency communication powered by a robust WebSocket implementation.
- **🧠 Butler Core**: An AI-driven coordinator that understands user intent and executes complex multi-agent workflows.
- **🖥️ Dual Butler Workspace**: Switch between direct conversation mode (`Me ↔ Butler`) and a timeline monitor (`Butler ↔ Agents`).
- **🌍 Bilingual UI**: Built-in English / Simplified Chinese language toggle for core admin and chat workflows.
- **⚙️ Settings Workspace**: Unified admin area for agent operations (create/remove agent, token lifecycle) and integrations (Feishu routing configuration).
- **🛰️ Feishu WS Bridge**: Feishu long-connection ingress with policy filtering, inbound/outbound relay, and connector credential verification.
- **✅ Feishu Approval Cards**: Butler authorization requests can be approved/rejected directly in Feishu interactive cards.
- **📊 Interactive Dashboard**: Modern React-based UI for monitoring agent status and system-wide logs.
- **🔒 Secure Architecture**: Mandatory JWT authentication, per-agent API tokens, and token-safe agent listing (`token_hint` only, no raw token exposure).
- **📂 Flexible Persistence**: Full chat and command history backed by a configurable database layer, with PostgreSQL enabled through `DB_DRIVER` + DSN/PG_* configuration.

## 🛠 Tech Stack

| Backend | Frontend | Agents |
| :--- | :--- | :--- |
| **Go 1.22+** | **React 19** | **Python 3.9+** |
| Gin Gonic | TypeScript | OpenAI SDK |
| Gorilla WebSocket | Tailwind CSS (v4) | websockets |
| Configurable SQL Storage / PostgreSQL | Zustand | psutil |
| Eino (AI Brain) | Shadcn/ui | python-dotenv |

## 🚀 Quick Start

### Prerequisites

- **Go**: 1.22 or higher
- **Node.js**: 20 or higher (pnpm recommended)
- **Python**: 3.9 or higher

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter

# 2. Install all dependencies (Backend, Frontend, Python)
# This will also create backend/.env from .env.example
make install

# 3. Configure API Keys
# Edit backend/.env and add your BUTLER_API_TOKEN (e.g., from SiliconFlow or OpenAI)
# and ensure JWT_SECRET is set to a strong random string.

# 4. (Optional) Configure PostgreSQL in backend/.env when needed
# Set DB_DRIVER=postgres

# 5. Launch with mock data and agents (recommended for first run)
make run-mock
```

Run `make help` to see all available commands.

The system will be available at `http://localhost:5173`. Default admin credentials: `admin` / `admin123`.

### Quick Driver Switch

```bash
# Default configuration
make run-mock RESET=1

# PostgreSQL (auto ensure/recreate database via backend/cmd/mockdb)
DB_DRIVER=postgres make run-mock RESET=1
```

`run-mock-sqllite` and `run-mock-postgre` are kept as deprecated compatibility aliases.

### LLM Stress Testing Branch

Because `main` is protected, the LLM stress tooling is maintained in a dedicated branch:

- Branch: `chore/mock-llm-loadtest`
- Purpose: mock-LLM pressure testing (`MOCK_MODE`, `make stress-llm`), SQLite vs PostgreSQL comparison workflow.

To run the stress test tooling:

```bash
git checkout chore/mock-llm-loadtest
make stress-llm
```

Comparison notes and result template live in:

- `docs/zh/development/db-stress-comparison-20260308.md`

Latest local comparison snapshot (`1000 req / 20 concurrency / MOCK_MODE=800ms`):

- SQLite:
  - `throughput=24.86 req/s`, `p50=802.2ms`
  - backend log signals: `save_fail=1503`, `SQLITE_BUSY=2040`
- Local PostgreSQL:
  - `throughput≈24.34 req/s`, `p50≈815.6ms`
  - backend log signals: `save_fail=0`, no lock-conflict signals

Note:
- `save_fail` is a log-level persistence-failure signal count (not request-level HTTP failure rate).
- Request-level status in this run remained `200/1000`, but SQLite showed clear concurrent-write instability in persistence logs.

### WebSocket Capacity Validation

- Date: `2026-03-08`
- Scenario: idle long-lived WebSocket connections (keepalive Ping, no business-message traffic)
- Result: `20,000 / 20,000` connections established and held (`100%`)
- Observed backend snapshot during hold:
  - RSS around `401MB~415MB`
  - Threads around `29`
- Practical interpretation: under this profile, EchoCenter can sustain at least `20,000` concurrently connected idle agents/clients.
- Stress tool branch (code is kept separate from this docs-only branch):
  - `git fetch origin`
  - `git checkout feat/ws-c10k-stress-test`

## 📖 Documentation

For detailed guides on architecture, API references, and agent integration, please visit our **[Official Documentation Site](https://l-rocket.github.io/EchoCenter/)**.

- [System Architecture](/architecture/overview)
- [API Reference](/api/authentication)
- [Agent Integration Guide](/development/agent-integration)
- [Development Setup](/development/setup)

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/L-Rocket">L-Rocket</a>
</p>
