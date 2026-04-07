.PHONY: help start stop install migrate \
        frontend-start backend-start catalog-start \
        frontend-install backend-install catalog-install \
        seed-taco seed-taco-dry \
        dev build restart logs logs-f ps clean \
        logs-frontend logs-backend logs-catalog logs-postgres

# ── Colours ────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
GREEN := \033[0;32m
RESET := \033[0m

# ── nvm ─────────────────────────────────────────────────────────────────────
# Source nvm so Make subshells use the version pinned in .nvmrc (node 22).
# Homebrew node (25.x) breaks due to a simdjson dylib version mismatch.
NVM_INIT := export NVM_DIR="$$HOME/.nvm"; [ -s "$$NVM_DIR/nvm.sh" ] && . "$$NVM_DIR/nvm.sh"; nvm use --silent

help:
	@echo ""
	@echo "$(CYAN)Nutri-IA Monorepo$(RESET)"
	@echo ""
	@echo "$(GREEN)Local development (no Docker for apps):$(RESET)"
	@echo "  make start              - Run all three apps concurrently"
	@echo "  make frontend-start     - Run frontend only  (pnpm dev, :3000)"
	@echo "  make backend-start      - Run backend only   (bun dev,  :4111)"
	@echo "  make catalog-start      - Run catalog only   (uvicorn,  :8000)"
	@echo ""
	@echo "$(GREEN)Database:$(RESET)"
	@echo "  make migrate            - Run Alembic migrations (create/update tables)"
	@echo "  make seed-taco          - Import ~600 TACO Brazilian foods into the DB"
	@echo "  make seed-taco-dry      - Dry-run: validate without writing to DB"
	@echo ""
	@echo "$(GREEN)Dependencies:$(RESET)"
	@echo "  make install            - Install deps for all apps"
	@echo "  make frontend-install   - pnpm install in apps/frontend"
	@echo "  make backend-install    - bun install in apps/backend"
	@echo "  make catalog-install    - pip install in apps/catalog venv"
	@echo ""
	@echo "$(GREEN)Docker (full stack):$(RESET)"
	@echo "  make dev                - docker compose up -d"
	@echo "  make build              - docker compose build --no-cache"
	@echo "  make stop               - docker compose down"
	@echo "  make restart            - stop + dev"
	@echo "  make logs               - last 100 lines of all services"
	@echo "  make logs-f             - follow logs"
	@echo "  make ps                 - list running containers"
	@echo "  make clean              - remove containers, volumes and images"
	@echo ""

# ── Local development ───────────────────────────────────────────────────────

start: migrate
	@echo "$(CYAN)Starting frontend, backend and catalog...$(RESET)"
	@echo "$(GREEN)  frontend$(RESET) → http://localhost:3000"
	@echo "$(GREEN)  backend $(RESET) → http://localhost:4111"
	@echo "$(GREEN)  catalog $(RESET) → http://localhost:8000"
	@echo "Press Ctrl+C to stop all services."
	@echo ""
	@trap 'kill 0' INT; \
	($(NVM_INIT) && cd apps/frontend && pnpm dev 2>&1 | sed 's/^/\033[0;36m[frontend]\033[0m /') & \
	($(NVM_INIT) && cd apps/backend  && bun  run dev 2>&1 | sed 's/^/\033[0;33m[backend ]\033[0m /') & \
	(cd apps/catalog  && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1 | sed 's/^/\033[0;32m[catalog ]\033[0m /') & \
	wait

frontend-start:
	@$(NVM_INIT) && cd apps/frontend && pnpm dev

backend-start:
	@$(NVM_INIT) && cd apps/backend && bun run dev

catalog-start: migrate
	cd apps/catalog && .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ── Install ─────────────────────────────────────────────────────────────────

install: frontend-install backend-install catalog-install

migrate:
	@echo "Running Alembic migrations..."
	cd apps/catalog && .venv/bin/alembic upgrade head
	@echo "Migrations done."

seed-taco:
	cd apps/catalog && .venv/bin/python scripts/import_taco.py

seed-taco-dry:
	cd apps/catalog && .venv/bin/python scripts/import_taco.py --dry-run

frontend-install:
	@$(NVM_INIT) && cd apps/frontend && pnpm install

backend-install:
	@$(NVM_INIT) && cd apps/backend && bun install

catalog-install:
	cd apps/catalog && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# ── Docker ──────────────────────────────────────────────────────────────────

dev:
	@echo "Starting all services via Docker..."
	@if [ ! -f .env ]; then \
		echo "Warning: .env not found. Copying from .env.example..."; \
		cp .env.example .env; \
		echo "Configure .env before continuing."; \
		exit 1; \
	fi
	docker compose up -d
	@echo ""
	@echo "Services available:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:4111"
	@echo "  Catalog:   http://localhost:8000"
	@echo "  Postgres:  localhost:5432"

build:
	docker compose build --no-cache

stop:
	docker compose down

restart: stop dev

logs:
	docker compose logs --tail=100

logs-f:
	docker compose logs -f

logs-frontend:
	docker compose logs -f frontend

logs-backend:
	docker compose logs -f backend

logs-catalog:
	docker compose logs -f catalog

logs-postgres:
	docker compose logs -f postgres

ps:
	@docker compose ps

clean:
	@echo "This will delete all container data. Continue? [y/N] "; \
	read REPLY; \
	if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
		docker compose down -v --rmi local; \
		rm -rf apps/frontend/node_modules apps/backend/node_modules; \
		rm -rf apps/frontend/.next apps/backend/dist apps/backend/.mastra; \
		echo "Done."; \
	else \
		echo "Cancelled."; \
	fi
