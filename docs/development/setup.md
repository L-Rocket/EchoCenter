# Environment Setup

## Overview

This guide describes how to set up the development environment for EchoCenter.

## Prerequisites

### Go 1.22+

```bash
# macOS
brew install go

# Ubuntu/Debian
sudo apt-get install golang-go

# CentOS/RHEL
sudo yum install golang
```

Verify installation:
```bash
go version
```

### Python 3.9+

```bash
# macOS
brew install python

# Ubuntu/Debian
sudo apt-get install python3

# CentOS/RHEL
sudo yum install python3
```

Verify installation:
```bash
python3 --version
```

### Node.js 20+

```bash
# macOS
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs
```

Verify installation:
```bash
node --version
npm --version
```

## Simplified Setup (Recommended)

If you have `make` installed, you can use the following commands to set up everything quickly:

```bash
# Install all dependencies (Go, Node, Python)
# This will automatically create backend/.env from backend/.env.example
make install

# Build the project
make build

# Run with mock data and agents (recommended for first run)
make run-mock

# Or run backend + frontend only (for development)
make dev
```

Run `make help` to see all available convenience commands.

## Manual Backend Setup

```bash
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter/backend
```

### 2. Install Dependencies

```bash
go mod download
```
### 3. Configure Environment Variables

The `make install` command automatically copies `.env.example` to `.env`. If you are doing it manually:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# Database Configuration
DB_DRIVER=sqlite
# Use DB_DSN directly, or PG_* split config when DB_DRIVER=postgres
DB_DSN=
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=echocenter
PG_SSLMODE=disable
# SQLite path (when DB_DRIVER=sqlite)
DB_PATH=./data/echo_center.db

# Butler Configuration
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=Qwen/Qwen3-8B

# JWT Configuration
JWT_SECRET=your_jwt_secret_here_at_least_32_characters_long
JWT_TOKEN_EXPIRATION=24h

# Initial Administrator
INITIAL_ADMIN_USER=admin
INITIAL_ADMIN_PASS=admin123

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Origin,Content-Type,Authorization
CORS_MAX_AGE=86400
```

PostgreSQL mock bootstrap behavior:
- `DB_DRIVER=postgres` + `make run-mock` will auto-ensure target DB.
- `DB_DRIVER=postgres` + `make run-mock RESET=1` will recreate target DB before seeding.

### 4. Run Backend

```bash
# Development mode
go run cmd/server/main.go

# Build and run
go build -o bin/server ./cmd/server
./bin/server
```

## Frontend Setup

### 1. Clone Repository

```bash
cd ../frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create `.env.local` file:

```env
VITE_API_URL=http://localhost:8080
```

### 4. Run Frontend

```bash
npm run dev
```

The frontend will run at `http://localhost:5173`.

## Agent Setup

### 1. Install Python Dependencies

```bash
cd ../backend
pip install -r mock_agents/requirements.txt --break-system-packages
```

### 2. Run Agent

```bash
python3 mock_agents/storage_custodian.py
```

## Startup Scripts

### Using Makefile (Recommended)

```bash
# Run with mock data and agents (backend + seed + agent + frontend)
make run-mock
```

This command will:
1. Start the backend service
2. Use current `.env` `DB_DRIVER` to prepare database
3. Initialize the database with mock data
4. Register all mock agents
5. Start the Storage-Custodian agent
6. Start the frontend

You can optionally keep existing database data:

```bash
make run-mock RESET=0
```

Quick one-off driver switch:

```bash
DB_DRIVER=sqlite make run-mock RESET=1
DB_DRIVER=postgres make run-mock RESET=1
```

Deprecated compatibility aliases:

```bash
make run-mock-sqllite
make run-mock-postgre
```

### Manual Startup

If you prefer to start services manually:

```bash
# Terminal 1: Backend
cd backend && go run cmd/server/main.go

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Agent (optional)
cd backend && python3 mock_agents/storage_custodian.py
```

### Stop Services
Press `Ctrl+C` to stop all services.

## Docker Setup

### Dockerfile

```dockerfile
FROM golang:1.21-alpine AS backend
WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN go build -o server ./cmd/server

FROM python:3.9-slim AS agents
WORKDIR /app
COPY backend/mock_agents/ ./mock_agents/
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

FROM node:18-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=backend /app/server /usr/local/bin/server
COPY --from=agents /app/mock_agents /app/mock_agents
COPY --from=frontend /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - BUTLER_BASE_URL=${BUTLER_BASE_URL}
      - BUTLER_API_TOKEN=${BUTLER_API_TOKEN}
      - BUTLER_MODEL=${BUTLER_MODEL}
    volumes:
      - ./backend/data:/app/data

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend
```

### Run Docker

```bash
docker-compose up --build
```

## Troubleshooting

### Go Module Download Failed
```bash
go mod tidy
go mod download
```

### Python Dependency Installation Failed
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend Dependency Installation Failed
```bash
npm cache clean --force
npm install
```

### Port Occupied
```bash
# macOS
lsof -ti:8080 | xargs kill -9

# Linux
lsof -ti:8080 | xargs kill -9
```

### Database Connection Failed
Check:
1. Database path is correct.
2. Database file has correct permissions.
3. Database is not occupied by another process.

## Best Practices

### 1. Use Virtual Environment
```bash
# Go
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin

# Python
python3 -m venv venv
source venv/bin/activate
```

### 2. Use Environment Variables
Do not commit sensitive information to the repository.

### 3. Use Version Control
```bash
git checkout -b feature/your-feature
# Develop
git add .
git commit -m "Add your feature"
git push origin feature/your-feature
```

### 4. Use Docker
Ensure environment consistency.

## Next Steps
- [Testing Guide](./testing.md)
- [Contributing Guide](./contributing.md)
