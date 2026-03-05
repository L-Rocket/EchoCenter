.PHONY: help install run run-mock dev dev-backend dev-frontend build lint test clean mock-start run-mock-sqllite run-mock-postgre

# Default goal
.DEFAULT_GOAL := help
RESET ?= 1

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (Go, Node, Python)
	@echo "Checking environment variables..."
	@if [ ! -f backend/.env ]; then \
		cp backend/.env.example backend/.env; \
		echo "Created backend/.env from .env.example"; \
	else \
		echo "backend/.env already exists"; \
	fi
	@echo "Installing backend dependencies..."
	cd backend && go mod download
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing Python dependencies..."
	pip3 install -r backend/mock_agents/requirements.txt 
dev-backend: ## Run backend in development mode
	cd backend && go run cmd/server/main.go

dev-frontend: ## Run frontend in development mode
	cd frontend && npm run dev

dev: ## Run both backend and frontend in parallel
	@echo "Starting backend and frontend... (Press Ctrl+C to stop)"
	@trap 'kill 0' INT; (cd backend && go run cmd/server/main.go) & (cd frontend && npm run dev)

run: ## Run backend + frontend with current .env database config
	@$(MAKE) dev

run-mock: ## Run full mock stack using DB_DRIVER in .env (optional: RESET=0)
	cd backend/scripts && RESET=$(RESET) ./run-mock.sh

mock-start: ## Backward-compatible alias for run-mock (defaults to RESET=1)
	cd backend/scripts && RESET=1 ./run-mock.sh

run-mock-sqllite: ## Deprecated alias, force SQLite and run mock stack
	cd backend/scripts && ./run-mock-sqllite.sh

run-mock-postgre: ## Deprecated alias, force PostgreSQL and run mock stack
	cd backend/scripts && ./run-mock-postgre.sh

build: ## Build both backend and frontend
	@echo "Building backend..."
	cd backend && go build -o bin/server ./cmd/server
	@echo "Building frontend..."
	cd frontend && npm run build

lint: ## Lint backend and frontend code
	@echo "Linting backend..."
	cd backend && go vet ./...
	@echo "Linting frontend..."
	cd frontend && npm run lint

test: ## Run backend and frontend tests
	@echo "Running backend tests..."
	cd backend && go test ./...
	@echo "Running frontend tests..."
	cd frontend && npm test

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf backend/bin
	rm -rf frontend/dist
	@echo "Clean complete"
