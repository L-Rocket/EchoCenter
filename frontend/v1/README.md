# EchoCenter Frontend

React + TypeScript + Vite admin/workspace UI for EchoCenter.

## Features

- Dashboard log stream
- Agent management and token operations
- Butler direct chat + Butler-Agent monitor
- Feishu connector settings (save / verify / enable / logs)
- Real-time WebSocket message rendering (`CHAT`, `CHAT_STREAM`, `AUTH_REQUEST`, `AUTH_STATUS_UPDATE`)

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`

Backend expected at: `http://localhost:8080` (configured via frontend env/config).

## Build

```bash
npm run build
```
