# EchoCenter

[Documentation Site](https://l-rocket.github.io/EchoCenter/) | [中文 README](./README.zh.md)

EchoCenter is an intelligent agent center system designed to coordinate and manage multiple AI agents. It provides a centralized platform for agent registration, message passing, command execution, and status monitoring.

## Features

- **Multi-Agent Management**: Register and manage multiple AI agents
- **Real-time Messaging**: Low-latency real-time communication via WebSocket
- **Command Execution**: Command passing and execution between agents
- **Status Monitoring**: Real-time monitoring of agent status and system metrics
- **Persistent Storage**: SQLite database for persisting chat history and system data
- **Authorization**: Secure user authentication and authorization system

## Architecture

### Backend

- **Gin Framework**: HTTP API service
- **WebSocket**: Real-time message passing
- **SQLite**: Local file database
- **Eino**: AI inference engine
- **Butler**: Core agent service

### Frontend

- **React**: User interface framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Styling framework
- **Vite**: Build tool

## Quick Start

### Prerequisites

- Go 1.21+
- Python 3.9+
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter

# Install backend dependencies
cd backend
go mod download

# Install frontend dependencies
cd ../frontend
npm install

# Install Python dependencies
cd ../backend
pip install -r requirements.txt
```

### Configuration

Configure environment variables in `backend/.env`:

```env
# Database configuration
DATABASE_URL=echocenter.db

# Butler configuration
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo

# JWT configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
```

### Running

Use the startup script to launch all services:

```bash
cd backend/scripts
./start_with_custodian.sh
```

This script will:
1. Start the backend service
2. Initialize the database
3. Register agents
4. Launch the Storage-Custodian agent

### Stopping

Press `Ctrl+C` to stop all services.

## Project Structure

```
EchoCenter/
├── backend/
│   ├── cmd/
│   │   └── server/          # Service entry point
│   ├── internal/
│   │   ├── api/             # API layer
│   │   │   ├── handler/     # Handlers
│   │   │   ├── middleware/  # Middleware
│   │   │   └── router/      # Routes
│   │   ├── butler/          # Butler service
│   │   ├── auth/            # Authentication service
│   │   ├── models/          # Data models
│   │   ├── repository/      # Data storage layer
│   │   └── websocket/       # WebSocket service
│   ├── scripts/             # Startup scripts
│   ├── mock_agents/         # Agent simulators
│   └── pkg/                 # Common packages
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Pages
│   │   ├── context/         # React Context
│   │   ├── store/           # State management
│   │   └── App.tsx          # Main application
│   └── package.json
├── specs/                   # Project specifications
└── README.md
```

## API Documentation

### Authentication

#### Login

```
POST /api/auth/login
```

Request body:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### WebSocket

Connection URL: `ws://localhost:8080/api/ws?token=your_token`

Message format:
```json
{
  "type": "CHAT",
  "sender_id": 1,
  "target_id": 2,
  "payload": "Hello",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Agents

### Butler

The core agent responsible for coordinating other agents and handling user requests.

### Storage-Custodian

Manages the storage system, responsible for file and disk space monitoring.

### Other Agents

- **Weather-Sentinel**: Weather monitoring agent
- **Code-Reviewer-AI**: Code review agent
- **Security-Audit-Bot**: Security audit agent
- **Echo-Bot**: Echo agent

## Development

### Backend Development

```bash
cd backend
go run cmd/server/main.go
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Running Tests

```bash
# Backend tests
cd backend
go test ./...

# Frontend tests
cd frontend
npm test
```

## License

MIT License

## Contributing

Issues and pull requests are welcome!
