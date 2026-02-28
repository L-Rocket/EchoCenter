# 环境设置

## 概述

本指南介绍如何设置 EchoCenter 的开发环境。

## 前置要求

### Go 1.21+

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

### Node.js 18+

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

# 启动所有服务 (后端, 数据初始化, 代理)
make run-full
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
DB_PATH=./echocenter.db

# Butler 配置
BUTLER_BASE_URL=https://api.siliconflow.cn/v1
BUTLER_API_TOKEN=your_api_token_here
BUTLER_MODEL=gpt-3.5-turbo

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

### 使用启动脚本

```bash
cd scripts
./start_with_custodian.sh
```

这个脚本会：
1. 启动后端服务
2. 初始化数据库
3. 注册代理
4. 启动 Storage-Custodian 代理

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
