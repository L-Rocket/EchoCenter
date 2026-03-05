# 环境设置

## 概述

本指南介绍如何设置 EchoCenter 的开发环境。

## 前置要求

### Go 1.22+

```bash
# macOS
brew install go

# Ubuntu/Debian
sudo apt-get install golang-go

# CentOS/RHEL
sudo yum install golang
```

验证安装：
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

验证安装：
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

验证安装：
```bash
node --version
npm --version
```

## 简化设置 (推荐)

如果你安装了 `make`，可以使用以下命令快速完成设置：

```bash
# 安装所有依赖 (Go, Node, Python)
make install

# 构建项目
make build

# 使用 mock 数据和代理启动 (首次运行推荐)
make run-mock

# 或者仅运行后端和前端 (开发模式)
make dev
```

输入 `make help` 可以查看所有可用的便捷命令。

## 后端手动设置

```bash
git clone https://github.com/L-Rocket/EchoCenter.git
cd EchoCenter/backend
```

### 2. 安装依赖

```bash
go mod download
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8080

# 数据库配置
DB_DRIVER=sqlite
# DB_DRIVER=postgres 时可直接配置 DB_DSN，或使用 PG_* 拆分配置
DB_DSN=
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=echocenter
PG_SSLMODE=disable
# DB_DRIVER=sqlite 时使用
DB_PATH=./data/echo_center.db

# Butler 配置
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=Qwen/Qwen3-8B

# JWT 配置
JWT_SECRET=your_jwt_secret_here_at_least_32_characters_long
JWT_TOKEN_EXPIRATION=24h

# 初始管理员
INITIAL_ADMIN_USER=admin
INITIAL_ADMIN_PASS=admin123

# CORS 配置
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
CORS_ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Origin,Content-Type,Authorization
CORS_MAX_AGE=86400
```

PostgreSQL 的 mock 启动行为：
- `DB_DRIVER=postgres` + `make run-mock` 会自动 ensure 目标数据库。
- `DB_DRIVER=postgres` + `make run-mock RESET=1` 会在注入 mock 前先重建目标数据库。

### 4. 运行后端

```bash
# 开发模式
go run cmd/server/main.go

# 构建并运行
go build -o bin/server ./cmd/server
./bin/server
```

## 前端设置

### 1. 克隆仓库

```bash
cd ../frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```env
VITE_API_URL=http://localhost:8080
```

### 4. 运行前端

```bash
npm run dev
```

前端将在 `http://localhost:5173` 运行。

## 代理设置

### 1. 安装 Python 依赖

```bash
cd ../backend
pip install -r mock_agents/requirements.txt
```

### 2. 运行代理

```bash
python3 mock_agents/storage_custodian.py
```

## 启动脚本

### 使用 Makefile (推荐)

```bash
# 使用 mock 数据和代理启动（后端 + 数据初始化 + 代理 + 前端）
make run-mock
```

这个命令会：
1. 启动后端服务
2. 按 `.env` 中 `DB_DRIVER` 准备数据库
3. 使用 mock 数据初始化数据库
4. 注册所有 mock 代理
5. 启动 Storage-Custodian 代理
6. 启动前端

如需保留现有数据库数据：

```bash
make run-mock RESET=0
```

快速一次性切换驱动：

```bash
DB_DRIVER=sqlite make run-mock RESET=1
DB_DRIVER=postgres make run-mock RESET=1
```

兼容别名（已废弃）：

```bash
make run-mock-sqllite
make run-mock-postgre
```

### 手动启动

如果你更喜欢手动启动服务：

```bash
# 终端 1: 后端
cd backend && go run cmd/server/main.go

# 终端 2: 前端
cd frontend && npm run dev

# 终端 3: 代理 (可选)
cd backend && python3 mock_agents/storage_custodian.py
```

### 停止服务

按 `Ctrl+C` 停止所有服务。

## Docker 设置

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

### 运行 Docker

```bash
docker-compose up --build
```

## 故障排除

### Go 模块下载失败

```bash
go mod tidy
go mod download
```

### Python 依赖安装失败

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 前端依赖安装失败

```bash
npm cache clean --force
npm install
```

### 端口被占用

```bash
# macOS
lsof -ti:8080 | xargs kill -9

# Linux
lsof -ti:8080 | xargs kill -9
```

### 数据库连接失败

检查：
1. 数据库路径是否正确
2. 数据库文件是否有权限
3. 数据库是否被其他进程占用

## 最佳实践

### 1. 使用虚拟环境

```bash
# Go
export GOPATH=$HOME/go
export PATH=$PATH:$GOPATH/bin

# Python
python3 -m venv venv
source venv/bin/activate
```

### 2. 使用环境变量

不要将敏感信息提交到代码仓库。

### 3. 使用版本控制

```bash
git checkout -b feature/your-feature
# 开发
git add .
git commit -m "Add your feature"
git push origin feature/your-feature
```

### 4. 使用 Docker

确保环境一致性。

## 下一步

- [测试指南](./testing.md)
- [贡献指南](./contributing.md)
