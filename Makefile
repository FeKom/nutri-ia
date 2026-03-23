.PHONY: help dev build stop clean logs logs-f restart ps

help:
	@echo "Nutri-IA Monorepo - Comandos Docker"
	@echo ""
	@echo "  make dev        - Sobe todos os serviços em desenvolvimento"
	@echo "  make build      - Rebuilda as imagens Docker"
	@echo "  make stop       - Para todos os serviços"
	@echo "  make restart    - Reinicia todos os serviços"
	@echo "  make logs       - Mostra logs recentes de todos os serviços"
	@echo "  make logs-f     - Mostra logs em tempo real (follow mode)"
	@echo "  make clean      - Remove containers, volumes e imagens"
	@echo "  make ps         - Lista serviços rodando"
	@echo ""
	@echo "Comandos individuais:"
	@echo "  make logs-frontend  - Logs do frontend"
	@echo "  make logs-backend   - Logs do backend"
	@echo "  make logs-catalog   - Logs do catalog"
	@echo "  make logs-postgres  - Logs do postgres"

dev:
	@echo "🚀 Subindo todos os serviços..."
	@if [ ! -f .env ]; then \
		echo "⚠️  Arquivo .env não encontrado. Criando a partir do .env.example..."; \
		cp .env.example .env; \
		echo "⚠️  IMPORTANTE: Configure as variáveis em .env antes de continuar!"; \
		exit 1; \
	fi
	docker-compose up -d
	@echo ""
	@echo "✅ Serviços disponíveis:"
	@echo "   Frontend:  http://localhost:3000"
	@echo "   Backend:   http://localhost:4111"
	@echo "   Catalog:   http://localhost:8000"
	@echo "   Postgres:  localhost:5432"
	@echo ""
	@echo "💡 Use 'make logs-f' para ver logs em tempo real"

build:
	@echo "🔨 Rebuilding imagens..."
	docker-compose build --no-cache

stop:
	@echo "🛑 Parando serviços..."
	docker-compose down

restart: stop dev

logs:
	docker-compose logs --tail=100

logs-f:
	docker-compose logs -f

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

logs-catalog:
	docker-compose logs -f catalog

logs-postgres:
	docker-compose logs -f postgres

clean:
	@echo "🧹 Limpando containers, volumes e imagens..."
	@read -p "⚠️  Isso vai deletar todos os dados do banco. Continuar? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v --rmi local; \
		rm -rf apps/frontend/node_modules apps/backend/node_modules; \
		rm -rf apps/frontend/.next apps/backend/dist apps/backend/.mastra; \
		echo "✅ Limpeza completa!"; \
	else \
		echo "❌ Cancelado."; \
	fi

ps:
	@docker-compose ps
