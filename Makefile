.PHONY: help install dev dev-backend dev-frontend build lint test seed clean run-full

# Default goal
.DEFAULT_GOAL := help

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (Go, Node, Python)
	@echo "Installing backend dependencies..."
	cd backend && go mod download
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Installing Python dependencies..."
	pip install -r backend/mock_agents/requirements.txt

dev-backend: ## Run backend in development mode
	cd backend && go run cmd/server/main.go

dev-frontend: ## Run frontend in development mode
	cd frontend && npm run dev

dev: ## Run both backend and frontend in parallel
	@echo "Starting backend and frontend... (Press Ctrl+C to stop)"
	@trap 'kill 0' INT; (cd backend && go run cmd/server/main.go) & (cd frontend && npm run dev)

run-full: ## Launch backend, seed data, and start mock agent
	cd backend/scripts && ./start_with_custodian.sh

seed: ## Seed the database with mock data
	cd backend/scripts && ./seed_mock_data.sh

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

clean: ## Clean up build artifacts and logs
	rm -rf backend/bin/
	rm -rf frontend/dist/
	rm -rf docs/.vitepress/dist/
	find . -name "*.log" -delete
