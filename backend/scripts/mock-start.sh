#!/bin/bash

# EchoCenter 完整启动脚本
# 启动顺序: 后端 -> Seed 数据 -> Python Agents -> 前端

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  EchoCenter 完整启动脚本"
echo "=========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$BACKEND_DIR")"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "项目目录: $PROJECT_DIR"

# 1. 清理端口和旧数据库
echo -e "${YELLOW}[1/5] 清理环境...${NC}"
lsof -ti:8080 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 加载 .env 获取数据库路径
if [ -f "$BACKEND_DIR/.env" ]; then
    DB_PATH=$(grep DB_PATH "$BACKEND_DIR/.env" | cut -d '=' -f2)
fi
DB_FILE=${DB_PATH:-"./data/echo_center.db"}

# 清理数据库文件 (如果是相对路径，相对于 backend 目录)
cd "$BACKEND_DIR"
if [ -f "$DB_FILE" ]; then
    echo "  正在清理旧数据库: $DB_FILE"
    rm -f "$DB_FILE"
fi
# 同时清理 WAL 模式产生的临时文件
rm -f "${DB_FILE}-wal" "${DB_FILE}-shm"

sleep 1

# 2. 启动后端
echo -e "${YELLOW}[2/5] 启动后端服务...${NC}"
cd "$BACKEND_DIR"
go build -o bin/server ./cmd/server
./bin/server &
BACKEND_PID=$!
echo -e "${GREEN}  后端已启动 (PID: $BACKEND_PID)${NC}"

# 等待后端初始化
echo "  等待后端初始化..."
sleep 5

# 3. Seed 数据
echo -e "${YELLOW}[3/5] 初始化数据库...${NC}"
cd "$SCRIPT_DIR"
./seed_mock_data.sh
cd "$BACKEND_DIR"

# 4. 启动 Python Agent
echo -e "${YELLOW}[4/5] 启动 Storage-Custodian Agent...${NC}"
python3 "$BACKEND_DIR/mock_agents/storage_custodian.py" &
AGENT_PID=$!
echo -e "${GREEN}  Storage-Custodian 已启动 (PID: $AGENT_PID)${NC}"

# 等待 agent 连接
sleep 2

# 5. 启动前端
echo -e "${YELLOW}[5/5] 启动前端...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}  前端已启动 (PID: $FRONTEND_PID)${NC}"

cd "$PROJECT_DIR"

echo ""
echo "=========================================="
echo -e "${GREEN}  所有服务已启动！${NC}"
echo "=========================================="
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8080"
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止所有服务...${NC}"
    kill $FRONTEND_PID 2>/dev/null || true
    kill $AGENT_PID 2>/dev/null || true
    kill $BACKEND_PID 2>/dev/null || true
    echo -e "${GREEN}所有服务已停止${NC}"
    exit 0
}

trap cleanup INT TERM

# 保持脚本运行
wait
