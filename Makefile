.PHONY: help install run run-mock dev dev-backend dev-frontend build lint test clean mock-start run-mock-sqllite run-mock-postgre

# Default goal
.DEFAULT_GOAL := help
RESET ?= 1
PYTHON_BIN ?= python3
OPENHANDS_PYTHON_VERSION ?= 3.12.12
OPENHANDS_LOCAL_PYTHON ?= $(CURDIR)/third_party/openhands/.runtime/python-$(OPENHANDS_PYTHON_VERSION)/bin/python3

# Frontend version selector
#   v1 = original React/Vite app
#   v2 = zero-build HTML design prototype wired to backend
#   v3 = v1 codebase restyled with v2's design language
FRONTEND_VERSION ?= v3
FRONTEND_DIR := frontend/$(FRONTEND_VERSION)

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Frontend version: \033[36m$(FRONTEND_VERSION)\033[0m (override with FRONTEND_VERSION=v1|v2)"

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
	@echo "Installing frontend dependencies ($(FRONTEND_VERSION))..."
	cd $(FRONTEND_DIR) && npm install
	@echo "Installing Python dependencies..."
	$(PYTHON_BIN) -m pip install -r backend/mock_agents/requirements.txt
	@echo "Preparing local OpenHands Python runtime..."
	@OPENHANDS_PYTHON_BIN="$$(OPENHANDS_PYTHON_VERSION=$(OPENHANDS_PYTHON_VERSION) bash third_party/openhands/ensure_python.sh)" && \
		"$$OPENHANDS_PYTHON_BIN" -m pip install -r third_party/openhands/requirements.txt && \
		PYTHON_BIN="$$OPENHANDS_PYTHON_BIN" bash third_party/openhands/install_sdk.sh
dev-backend: ## Run backend in development mode
	cd backend && go run cmd/server/main.go

dev-frontend: ## Run frontend in development mode (FRONTEND_VERSION=v1|v2)
	cd $(FRONTEND_DIR) && npm run dev

dev: ## Run backend + frontend together (FRONTEND_VERSION=v1|v2)
	@echo "Starting backend and frontend ($(FRONTEND_VERSION))... (Press Ctrl+C to stop)"
	@set -m; \
		trap 'trap - INT TERM EXIT; kill 0 2>/dev/null; exit 0' INT TERM EXIT; \
		(cd backend && go run cmd/server/main.go) & \
		(cd $(FRONTEND_DIR) && npm run dev) & \
		wait

run: ## Run backend + frontend with current .env database config
	@$(MAKE) dev FRONTEND_VERSION=$(FRONTEND_VERSION)

run-mock: ## Run full mock stack (backend + agents + frontend). Optional: RESET=0, FRONTEND_VERSION=v1|v2
	cd backend/scripts && RESET=$(RESET) FRONTEND_VERSION=$(FRONTEND_VERSION) ./run-mock.sh

mock-start: ## Backward-compatible alias for run-mock (defaults to RESET=1)
	cd backend/scripts && RESET=1 ./run-mock.sh

run-mock-sqllite: ## Deprecated alias for the mock stack runner
	cd backend/scripts && ./run-mock-sqllite.sh

run-mock-postgre: ## Deprecated alias, force PostgreSQL and run mock stack
	cd backend/scripts && ./run-mock-postgre.sh

build: ## Build both backend and frontend
	@echo "Building backend..."
	cd backend && go build -o bin/server ./cmd/server
	@echo "Building frontend ($(FRONTEND_VERSION))..."
	cd $(FRONTEND_DIR) && npm run build

lint: ## Lint backend and frontend code
	@echo "Linting backend..."
	cd backend && go vet ./...
	@echo "Linting frontend ($(FRONTEND_VERSION))..."
	cd $(FRONTEND_DIR) && npm run lint

test: ## Run backend and frontend tests
	@echo "Running backend tests..."
	cd backend && go test ./...
	@echo "Running frontend tests ($(FRONTEND_VERSION))..."
	cd $(FRONTEND_DIR) && npm test

clean: ## Clean build artifacts
	@echo "Cleaning..."
	rm -rf backend/bin
	rm -rf frontend/v1/dist frontend/v2/dist frontend/v3/dist
	@echo "Clean complete"
