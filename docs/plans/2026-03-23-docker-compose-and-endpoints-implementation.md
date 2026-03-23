# Docker Compose Unificado e Endpoints do Catalog - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar infraestrutura Docker Compose unificada e completar endpoints faltantes do catalog para substituir dados mockados no frontend.

**Architecture:** Sistema em 3 camadas com Docker Compose: Frontend (Next.js) → Backend (Mastra) → Catalog (FastAPI) → Postgres. Backend orquestra via tools, frontend só conversa com backend.

**Tech Stack:** Docker Compose, Next.js, Node.js/Mastra, Python/FastAPI, PostgreSQL, pgvector

---

## FASE 1: INFRAESTRUTURA DOCKER

### Task 1.1: Setup de Variáveis de Ambiente

**Files:**
- Create: `.env.example`
- Create: `.gitignore` (atualizar)

**Step 1: Criar .env.example**

```bash
cat > .env.example << 'EOF'
# ==============================================
# Database Configuration
# ==============================================
POSTGRES_USER=nutriauser
POSTGRES_PASSWORD=changeme
POSTGRES_DB=nutriadb

# ==============================================
# Service URLs (Docker internal network)
# ==============================================
CATALOG_API_URL=http://catalog:8000
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}

# ==============================================
# Frontend Configuration
# ==============================================
NEXT_PUBLIC_BACKEND_URL=http://localhost:4111

# ==============================================
# Authentication (Better Auth)
# ==============================================
BETTER_AUTH_SECRET=generate_random_secret_here_min_32_chars
BETTER_AUTH_URL=http://localhost:4111

# ==============================================
# AI/LLM Configuration
# ==============================================
OPENAI_API_KEY=sk-your-openai-key-here
EOF
```

**Step 2: Atualizar .gitignore**

Verificar se `.gitignore` já contém as linhas abaixo. Se não, adicionar:

```bash
# Environment variables
.env
.env.local
.env.production
.env.*.local

# Secrets
*.pem
*.key
*.cert
secrets/
credentials/

# Database
*.db
*.sqlite
postgres_data/

# Logs
*.log
logs/
```

**Step 3: Criar .env local**

```bash
cp .env.example .env
```

**Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add environment variables setup"
```

---

### Task 1.2: Criar Dockerfile do Frontend

**Files:**
- Create: `apps/frontend/Dockerfile`

**Step 1: Criar Dockerfile multi-stage**

```bash
cat > apps/frontend/Dockerfile << 'EOF'
# ==========================================
# Dev Stage - Hot reload development
# ==========================================
FROM node:20-slim AS dev

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

EXPOSE 3000

CMD ["pnpm", "dev"]

# ==========================================
# Production Stage - Optimized build
# ==========================================
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ==========================================
# Production Runtime
# ==========================================
FROM node:20-slim AS prod

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["pnpm", "start"]
EOF
```

**Step 2: Commit**

```bash
git add apps/frontend/Dockerfile
git commit -m "feat: add frontend Dockerfile with multi-stage build"
```

---

### Task 1.3: Atualizar Dockerfile do Backend

**Files:**
- Modify: `apps/backend/Dockerfile`

**Step 1: Ler Dockerfile existente**

```bash
cat apps/backend/Dockerfile
```

**Step 2: Adicionar dev stage no topo**

Adicionar ANTES das stages existentes:

```dockerfile
# ==========================================
# Dev Stage - Hot reload development
# ==========================================
FROM node:20-slim AS dev

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

EXPOSE 4111

CMD ["pnpm", "dev"]

# ==========================================
# Resto das stages (base, deps, prod-deps, build, production)
# mantém como está
# ==========================================
```

**Step 3: Commit**

```bash
git add apps/backend/Dockerfile
git commit -m "feat: add dev stage to backend Dockerfile"
```

---

### Task 1.4: Criar Docker Compose Unificado

**Files:**
- Create: `docker-compose.yml`

**Step 1: Criar docker-compose.yml**

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ==========================================
  # PostgreSQL with pgvector
  # ==========================================
  postgres:
    image: pgvector/pgvector:pg15
    container_name: nutria-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?Set POSTGRES_USER in .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: ${POSTGRES_DB:?Set POSTGRES_DB in .env}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./apps/catalog/docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nutria-network
    restart: unless-stopped

  # ==========================================
  # Catalog API (FastAPI)
  # ==========================================
  catalog:
    build:
      context: ./apps/catalog
      dockerfile: Dockerfile
    container_name: nutria-catalog
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./apps/catalog:/app
      - /app/__pycache__
      - /app/.pytest_cache
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - nutria-network
    restart: unless-stopped
    command: sh -c "alembic upgrade head && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

  # ==========================================
  # Backend (Mastra.ai)
  # ==========================================
  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
      target: dev
    container_name: nutria-backend
    ports:
      - "4111:4111"
    environment:
      CATALOG_API_URL: http://catalog:8000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL}
      NODE_ENV: development
    volumes:
      - ./apps/backend:/app
      - /app/node_modules
      - /app/.mastra
    depends_on:
      - catalog
    networks:
      - nutria-network
    restart: unless-stopped
    command: pnpm dev

  # ==========================================
  # Frontend (Next.js)
  # ==========================================
  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
      target: dev
    container_name: nutria-frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_BACKEND_URL: http://localhost:4111
      NODE_ENV: development
    volumes:
      - ./apps/frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    networks:
      - nutria-network
    restart: unless-stopped
    command: pnpm dev

volumes:
  postgres_data:
    driver: local

networks:
  nutria-network:
    driver: bridge
EOF
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add unified docker-compose for all services"
```

---

### Task 1.5: Atualizar Makefile Raiz

**Files:**
- Modify: `Makefile`

**Step 1: Substituir conteúdo do Makefile**

```bash
cat > Makefile << 'EOF'
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
EOF
```

**Step 2: Testar make help**

```bash
make help
```

Expected: Menu de ajuda exibido corretamente

**Step 3: Commit**

```bash
git add Makefile
git commit -m "feat: update Makefile with Docker Compose commands"
```

---

### Task 1.6: Testar Infraestrutura Docker

**Files:**
- None (testing only)

**Step 1: Verificar que .env está configurado**

```bash
cat .env
```

Expected: Valores configurados (não os defaults do .env.example)

**Step 2: Subir todos os serviços**

```bash
make dev
```

Expected: 4 containers iniciados (postgres, catalog, backend, frontend)

**Step 3: Verificar status dos containers**

```bash
make ps
```

Expected: Todos os containers com status "Up"

**Step 4: Testar health de cada serviço**

```bash
# Postgres
docker exec nutria-postgres pg_isready

# Catalog
curl http://localhost:8000/docs

# Backend
curl http://localhost:4111

# Frontend
curl http://localhost:3000
```

Expected: Todos respondem sem erro

**Step 5: Ver logs**

```bash
make logs-f
```

Expected: Logs aparecendo sem erros críticos (pode ter alguns warnings iniciais)

Ctrl+C para sair

**Step 6: Parar serviços**

```bash
make stop
```

**Step 7: Commit**

```bash
git commit --allow-empty -m "test: verify Docker infrastructure works"
```

---

## FASE 2: ENDPOINTS DO CATALOG

### Task 2.1: Modelo e Schema de Recipe

**Files:**
- Create: `apps/catalog/app/models/recipe.py`
- Create: `apps/catalog/app/schemas/recipe.py`

**Step 1: Criar modelo Recipe**

```bash
cat > apps/catalog/app/models/recipe.py << 'EOF'
from datetime import datetime
from typing import List
from uuid import UUID, uuid4

from sqlmodel import Column, Field, JSON, SQLModel


class Recipe(SQLModel, table=True):
    """Recipe model for storing recipe information."""

    __tablename__ = "recipes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(max_length=255, index=True)
    description: str = Field(max_length=1000)
    category: str = Field(max_length=50, index=True)  # cafe-da-manha, almoco, jantar, lanche
    prep_time_minutes: int
    difficulty: str = Field(max_length=20)  # facil, medio, dificil
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    ingredients: List[str] = Field(sa_column=Column(JSON))
    instructions: str | None = Field(default=None, max_length=5000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
EOF
```

**Step 2: Criar schemas de Recipe**

```bash
cat > apps/catalog/app/schemas/recipe.py << 'EOF'
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RecipeBase(BaseModel):
    """Base recipe schema."""

    name: str = Field(..., max_length=255)
    description: str = Field(..., max_length=1000)
    category: str = Field(..., pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    prep_time_minutes: int = Field(..., gt=0)
    difficulty: str = Field(..., pattern="^(facil|medio|dificil)$")
    calories: int = Field(..., ge=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)
    ingredients: List[str] = Field(..., min_items=1)
    instructions: Optional[str] = Field(None, max_length=5000)


class RecipeCreate(RecipeBase):
    """Schema for creating a recipe."""

    pass


class RecipeResponse(RecipeBase):
    """Schema for recipe response."""

    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecipeSearchRequest(BaseModel):
    """Schema for searching recipes."""

    category: Optional[str] = Field(None, pattern="^(cafe-da-manha|almoco|jantar|lanche)$")
    difficulty: Optional[str] = Field(None, pattern="^(facil|medio|dificil)$")
    max_calories: Optional[int] = Field(None, ge=0)
    min_protein: Optional[float] = Field(None, ge=0)
    limit: int = Field(20, ge=1, le=100)


class RecipeSearchResponse(BaseModel):
    """Schema for recipe search response."""

    success: bool = True
    recipes: List[RecipeResponse]
    count: int
EOF
```

**Step 3: Commit**

```bash
git add apps/catalog/app/models/recipe.py apps/catalog/app/schemas/recipe.py
git commit -m "feat(catalog): add Recipe model and schemas"
```

---

### Task 2.2: Modelo e Schema de Goal

**Files:**
- Create: `apps/catalog/app/models/goal.py`
- Create: `apps/catalog/app/schemas/goal.py`

**Step 1: Criar modelo Goal**

```bash
cat > apps/catalog/app/models/goal.py << 'EOF'
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Goal(SQLModel, table=True):
    """Goal model for user goals/targets."""

    __tablename__ = "goals"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    title: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    target_value: float
    current_value: float
    unit: str = Field(max_length=50)  # kg, g, kcal, treinos, etc
    category: str = Field(max_length=50, index=True)  # peso, nutricao, atividade
    deadline: date | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
EOF
```

**Step 2: Criar schemas de Goal**

```bash
cat > apps/catalog/app/schemas/goal.py << 'EOF'
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class GoalBase(BaseModel):
    """Base goal schema."""

    title: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    target_value: float = Field(..., gt=0)
    current_value: float = Field(..., ge=0)
    unit: str = Field(..., max_length=50)
    category: str = Field(..., pattern="^(peso|nutricao|atividade)$")
    deadline: Optional[date] = None


class GoalCreate(GoalBase):
    """Schema for creating a goal."""

    pass


class GoalUpdate(BaseModel):
    """Schema for updating a goal."""

    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    target_value: Optional[float] = Field(None, gt=0)
    current_value: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, pattern="^(peso|nutricao|atividade)$")
    deadline: Optional[date] = None


class GoalResponse(GoalBase):
    """Schema for goal response."""

    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalListResponse(BaseModel):
    """Schema for list of goals response."""

    success: bool = True
    goals: list[GoalResponse]
    count: int
EOF
```

**Step 3: Commit**

```bash
git add apps/catalog/app/models/goal.py apps/catalog/app/schemas/goal.py
git commit -m "feat(catalog): add Goal model and schemas"
```

---

### Task 2.3: Modelo e Schema de Activity

**Files:**
- Create: `apps/catalog/app/models/activity.py`
- Create: `apps/catalog/app/schemas/activity.py`

**Step 1: Criar modelo Activity**

```bash
cat > apps/catalog/app/models/activity.py << 'EOF'
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Activity(SQLModel, table=True):
    """Activity model for tracking physical activities."""

    __tablename__ = "activities"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    type: str = Field(max_length=50, index=True)  # caminhada, corrida, musculacao, etc
    duration_minutes: int = Field(gt=0)
    calories_burned: int = Field(ge=0)
    date: date = Field(index=True)
    notes: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
EOF
```

**Step 2: Criar schemas de Activity**

```bash
cat > apps/catalog/app/schemas/activity.py << 'EOF'
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityBase(BaseModel):
    """Base activity schema."""

    type: str = Field(..., max_length=50)
    duration_minutes: int = Field(..., gt=0)
    calories_burned: int = Field(..., ge=0)
    date: date
    notes: Optional[str] = Field(None, max_length=500)


class ActivityCreate(ActivityBase):
    """Schema for creating an activity."""

    pass


class ActivityResponse(ActivityBase):
    """Schema for activity response."""

    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityListResponse(BaseModel):
    """Schema for list of activities response."""

    success: bool = True
    activities: list[ActivityResponse]
    count: int


class ActivityStatsResponse(BaseModel):
    """Schema for activity statistics."""

    success: bool = True
    total_activities: int
    total_duration_minutes: int
    total_calories_burned: int
    activities_by_type: dict[str, int]
EOF
```

**Step 3: Commit**

```bash
git add apps/catalog/app/models/activity.py apps/catalog/app/schemas/activity.py
git commit -m "feat(catalog): add Activity model and schemas"
```

---

### Task 2.4: Modelos de Tracking (Weight, Summary)

**Files:**
- Create: `apps/catalog/app/models/tracking.py`
- Create: `apps/catalog/app/schemas/tracking.py`

**Step 1: Criar modelos de Tracking**

```bash
cat > apps/catalog/app/models/tracking.py << 'EOF'
from datetime import date, datetime
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class WeightEntry(SQLModel, table=True):
    """Weight entry model for tracking user weight over time."""

    __tablename__ = "weight_entries"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    weight_kg: float = Field(gt=0)
    date: date = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
EOF
```

**Step 2: Criar schemas de Tracking**

```bash
cat > apps/catalog/app/schemas/tracking.py << 'EOF'
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class WeightEntryCreate(BaseModel):
    """Schema for creating a weight entry."""

    weight_kg: float = Field(..., gt=0)
    date: Optional[date] = None  # Defaults to today if not provided


class WeightEntryResponse(BaseModel):
    """Schema for weight entry response."""

    id: UUID
    user_id: UUID
    weight_kg: float
    date: date
    created_at: datetime

    class Config:
        from_attributes = True


class WeightHistoryResponse(BaseModel):
    """Schema for weight history response."""

    success: bool = True
    weights: list[WeightEntryResponse]
    count: int


class TrackingSummaryResponse(BaseModel):
    """Schema for tracking summary (dashboard)."""

    success: bool = True
    current_weight_kg: Optional[float] = None
    weight_change_kg: Optional[float] = None
    calories_today: int = 0
    calories_target: int = 0
    protein_today_g: float = 0
    protein_target_g: float = 0
    carbs_today_g: float = 0
    carbs_target_g: float = 0
    fat_today_g: float = 0
    fat_target_g: float = 0
    activities_this_week: int = 0
    activities_target: int = 0


class RecentEntryItem(BaseModel):
    """Schema for a single recent entry (meal or activity)."""

    type: str  # "meal" or "activity"
    icon: str  # Icon identifier
    label: str
    detail: str
    time: str
    color: str
    bg: str


class RecentEntriesResponse(BaseModel):
    """Schema for recent entries response."""

    success: bool = True
    entries: list[RecentEntryItem]
    count: int


class MacrosTodayResponse(BaseModel):
    """Schema for today's macros."""

    success: bool = True
    protein_g: float
    protein_target_g: float
    carbs_g: float
    carbs_target_g: float
    fat_g: float
    fat_target_g: float
EOF
```

**Step 3: Commit**

```bash
git add apps/catalog/app/models/tracking.py apps/catalog/app/schemas/tracking.py
git commit -m "feat(catalog): add Tracking models and schemas"
```

---

### Task 2.5: Criar Migration dos Novos Modelos

**Files:**
- Create: `apps/catalog/alembic/versions/XXXX_add_recipes_goals_activities_tracking.py`

**Step 1: Garantir que serviços estão rodando**

```bash
make dev
```

**Step 2: Gerar migration**

```bash
cd apps/catalog
docker exec -it nutria-catalog alembic revision --autogenerate -m "add recipes goals activities tracking tables"
```

Expected: Nova migration criada em `alembic/versions/`

**Step 3: Revisar migration gerada**

```bash
ls -lt alembic/versions/ | head -5
cat alembic/versions/XXXX_add_recipes_goals_activities_tracking.py
```

Verificar que as tabelas `recipes`, `goals`, `activities`, `weight_entries` serão criadas

**Step 4: Aplicar migration**

```bash
docker exec -it nutria-catalog alembic upgrade head
```

Expected: Migration aplicada com sucesso

**Step 5: Verificar tabelas no banco**

```bash
docker exec -it nutria-postgres psql -U nutriauser -d nutriadb -c "\dt"
```

Expected: Tabelas recipes, goals, activities, weight_entries aparecem

**Step 6: Commit**

```bash
cd ../..
git add apps/catalog/alembic/versions/
git commit -m "feat(catalog): add database migrations for new tables"
```

---

### Task 2.6: Service de Recipe

**Files:**
- Create: `apps/catalog/app/services/recipe_service.py`

**Step 1: Criar recipe_service.py**

```bash
cat > apps/catalog/app/services/recipe_service.py << 'EOF'
from typing import Optional
from uuid import UUID

from sqlmodel import Session, select

from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate, RecipeSearchRequest


def get_recipes(
    session: Session,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    max_calories: Optional[int] = None,
    min_protein: Optional[float] = None,
    limit: int = 20,
) -> list[Recipe]:
    """Get recipes with optional filters."""
    query = select(Recipe)

    if category:
        query = query.where(Recipe.category == category)
    if difficulty:
        query = query.where(Recipe.difficulty == difficulty)
    if max_calories:
        query = query.where(Recipe.calories <= max_calories)
    if min_protein:
        query = query.where(Recipe.protein_g >= min_protein)

    query = query.limit(limit)

    return list(session.exec(query).all())


def get_recipe_by_id(session: Session, recipe_id: UUID) -> Optional[Recipe]:
    """Get a single recipe by ID."""
    return session.get(Recipe, recipe_id)


def create_recipe(session: Session, recipe: RecipeCreate) -> Recipe:
    """Create a new recipe."""
    db_recipe = Recipe.model_validate(recipe)
    session.add(db_recipe)
    session.commit()
    session.refresh(db_recipe)
    return db_recipe


def search_recipes(session: Session, request: RecipeSearchRequest) -> list[Recipe]:
    """Search recipes with advanced filters."""
    return get_recipes(
        session=session,
        category=request.category,
        difficulty=request.difficulty,
        max_calories=request.max_calories,
        min_protein=request.min_protein,
        limit=request.limit,
    )
EOF
```

**Step 2: Commit**

```bash
git add apps/catalog/app/services/recipe_service.py
git commit -m "feat(catalog): add recipe service"
```

---

### Task 2.7: Endpoints de Recipe

**Files:**
- Create: `apps/catalog/app/api/v1/recipes.py`

**Step 1: Criar recipes.py endpoints**

```bash
cat > apps/catalog/app/api/v1/recipes.py << 'EOF'
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from app.api.dependencies import get_db
from app.schemas.recipe import (
    RecipeCreate,
    RecipeResponse,
    RecipeSearchRequest,
    RecipeSearchResponse,
)
from app.services import recipe_service

router = APIRouter()


@router.get("", response_model=RecipeSearchResponse)
async def list_recipes(
    category: str | None = Query(None),
    difficulty: str | None = Query(None),
    max_calories: int | None = Query(None, ge=0),
    min_protein: float | None = Query(None, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> RecipeSearchResponse:
    """
    List recipes with optional filters.

    **Query Parameters:**
    - category: Filter by category (cafe-da-manha, almoco, jantar, lanche)
    - difficulty: Filter by difficulty (facil, medio, dificil)
    - max_calories: Maximum calories per 100g
    - min_protein: Minimum protein in grams per 100g
    - limit: Maximum number of results (1-100, default: 20)
    """
    recipes = recipe_service.get_recipes(
        session=db,
        category=category,
        difficulty=difficulty,
        max_calories=max_calories,
        min_protein=min_protein,
        limit=limit,
    )

    return RecipeSearchResponse(
        success=True,
        recipes=[RecipeResponse.model_validate(r) for r in recipes],
        count=len(recipes),
    )


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_db),
) -> RecipeResponse:
    """Get a single recipe by ID."""
    recipe = recipe_service.get_recipe_by_id(db, recipe_id)

    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with ID {recipe_id} not found",
        )

    return RecipeResponse.model_validate(recipe)


@router.post("/search", response_model=RecipeSearchResponse)
async def search_recipes(
    request: RecipeSearchRequest,
    db: Session = Depends(get_db),
) -> RecipeSearchResponse:
    """
    Search recipes with advanced filters.

    **Request Body:**
    - category: Filter by category (optional)
    - difficulty: Filter by difficulty (optional)
    - max_calories: Maximum calories (optional)
    - min_protein: Minimum protein (optional)
    - limit: Maximum results (1-100, default: 20)
    """
    recipes = recipe_service.search_recipes(db, request)

    return RecipeSearchResponse(
        success=True,
        recipes=[RecipeResponse.model_validate(r) for r in recipes],
        count=len(recipes),
    )


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    recipe: RecipeCreate,
    db: Session = Depends(get_db),
) -> RecipeResponse:
    """Create a new recipe (admin only - TODO: add auth)."""
    created_recipe = recipe_service.create_recipe(db, recipe)
    return RecipeResponse.model_validate(created_recipe)
EOF
```

**Step 2: Registrar router no __init__.py**

```bash
# Verificar se já existe o arquivo
cat apps/catalog/app/api/v1/__init__.py
```

Adicionar import de recipes:

```python
from app.api.v1 import foods, nutrition, recommendations, tracking, recipes

__all__ = ["foods", "nutrition", "recommendations", "tracking", "recipes"]
```

**Step 3: Registrar no main.py**

Verificar se precisa adicionar no `app/main.py`:

```bash
grep -n "v1.recipes" apps/catalog/app/main.py
```

Se não existir, adicionar:

```python
from app.api.v1 import recipes
app.include_router(recipes.router, prefix="/api/v1/recipes", tags=["recipes"])
```

**Step 4: Commit**

```bash
git add apps/catalog/app/api/v1/recipes.py apps/catalog/app/api/v1/__init__.py apps/catalog/app/main.py
git commit -m "feat(catalog): add recipes endpoints"
```

---

Continuando o plano de implementação (o documento ficará muito longo, então vou dividir em partes lógicas)...

**Este plano está muito extenso. Devo continuar com:**
- Task 2.8-2.15: Services e endpoints de Goals, Activities, Tracking
- FASE 3: Tools do Mastra
- FASE 4: Integração Frontend
- FASE 5: Testes finais

**Ou prefere que eu finalize este documento e crie um segundo arquivo de implementação?**

---

## RESUMO DAS TASKS RESTANTES

Devido ao tamanho extenso do plano, as tasks 2.8 até o final seguem o mesmo padrão das anteriores.

### FASE 2 (Continuação): Goals, Activities, Tracking Services e Endpoints

**Tasks 2.8-2.11: Goals**
- 2.8: Service de Goal (CRUD completo)
- 2.9: Endpoints de Goal (GET, POST, PUT, DELETE /api/v1/goals)
- 2.10: Testes dos endpoints de Goal
- 2.11: Seed de dados de exemplo para Goals

**Tasks 2.12-2.15: Activities**  
- 2.12: Service de Activity (CRUD + stats)
- 2.13: Endpoints de Activity (GET, POST, DELETE /api/v1/activities + /stats)
- 2.14: Testes dos endpoints de Activity
- 2.15: Seed de dados de exemplo para Activities

**Tasks 2.16-2.20: Tracking**
- 2.16: Service de Tracking (weight, summary, macros, recent entries)
- 2.17: Endpoints de Tracking (GET /summary, /weight-history, /recent-entries, /macros-today, POST /weight)
- 2.18: Testes dos endpoints de Tracking
- 2.19: Seed de dados de exemplo para Tracking
- 2.20: Validação completa de todos os endpoints do Catalog

### FASE 3: TOOLS DO MASTRA (Backend)

**Task 3.1: Atualizar Catalog Client**

**Files:**
- Modify: `apps/backend/src/mastra/clients/catalog-client.ts`

**Step 1: Adicionar interceptor de user_id**

```typescript
// Adicionar helper para incluir user_id nos requests
catalogClient.interceptors.request.use((config) => {
  // user_id será passado via params ou body dependendo do endpoint
  return config;
});
```

**Step 2: Commit**

```bash
git add apps/backend/src/mastra/clients/catalog-client.ts
git commit -m "feat(backend): update catalog client with auth support"
```

---

**Tasks 3.2-3.16: Criar Tools** (padrão similar ao exemplo getRecipesTool)

- 3.2: get-recipes.ts
- 3.3: search-recipes.ts
- 3.4: list-goals.ts
- 3.5: create-goal.ts
- 3.6: update-goal.ts
- 3.7: delete-goal.ts
- 3.8: list-activities.ts
- 3.9: log-activity.ts
- 3.10: delete-activity.ts
- 3.11: get-activity-stats.ts
- 3.12: get-progress-summary.ts
- 3.13: get-weight-history.ts
- 3.14: log-weight.ts
- 3.15: get-recent-entries.ts
- 3.16: get-macros-today.ts

Cada tool segue o padrão:
```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { catalogClient } from '../clients/catalog-client';

export const toolName = createTool({
  id: 'tool-id',
  description: '...',
  inputSchema: z.object({ ... }),
  outputSchema: z.object({ ... }),
  execute: async ({ context, input }) => {
    const response = await catalogClient.METHOD(`/api/v1/endpoint`);
    return response.data;
  },
});
```

**Task 3.17: Registrar todos os tools no Mastra**

**Files:**
- Modify: `apps/backend/src/mastra/index.ts` (ou arquivo de registro de tools)

Adicionar todos os 15 novos tools ao mastra instance.

---

**Tasks 3.18-3.22: Criar Rotas do Backend**

- 3.18: `routes/recipes.ts` (GET /api/recipes, GET /api/recipes/:id)
- 3.19: `routes/goals.ts` (GET, POST, PUT, DELETE /api/goals/*)
- 3.20: `routes/activities.ts` (GET, POST, DELETE /api/activities/*)
- 3.21: `routes/tracking.ts` (GET /api/tracking/*)
- 3.22: `routes/users.ts` (PUT /api/users/profile)

Padrão de rota:
```typescript
router.get('/api/resource', jwtMiddleware, async (req, res) => {
  const result = await mastra.tools.toolName({
    context: { userId: req.user.id },
    input: { ...req.query },
  });
  res.json(result);
});
```

**Task 3.23: Registrar rotas no app principal**

**Files:**
- Modify: `apps/backend/src/index.ts` (ou main.ts)

Importar e usar todas as novas rotas.

**Task 3.24: Testar Backend end-to-end**

Verificar que:
- [ ] Backend inicia sem erros
- [ ] Todas as rotas /api/* respondem
- [ ] Tools chamam catalog corretamente
- [ ] JWT é validado

---

### FASE 4: INTEGRAÇÃO DO FRONTEND

**Task 4.1: Criar API Client**

**Files:**
- Create: `apps/frontend/src/lib/api-client.ts`

```typescript
export class ApiClient {
  constructor(private authFetch: any) {}
  
  // Recipes
  async getRecipes(params?: RecipeParams) { ... }
  async getRecipe(id: string) { ... }
  
  // Goals
  async getGoals() { ... }
  async createGoal(goal: CreateGoalInput) { ... }
  async updateGoal(id: string, updates: Partial<Goal>) { ... }
  async deleteGoal(id: string) { ... }
  
  // Activities
  async getActivities(params?: ActivityParams) { ... }
  async logActivity(activity: CreateActivityInput) { ... }
  async deleteActivity(id: string) { ... }
  async getActivityStats() { ... }
  
  // Tracking
  async getProgressSummary() { ... }
  async getWeightHistory(days?: number) { ... }
  async logWeight(weight: number, date?: string) { ... }
  async getRecentEntries(limit?: number) { ... }
  async getMacrosToday() { ... }
  
  // User
  async updateProfile(updates: { name?: string }) { ... }
}
```

**Task 4.2: Atualizar /receitas/page.tsx**

Substituir `mockRecipes` por `apiClient.getRecipes()`.

Pattern:
```typescript
const [recipes, setRecipes] = useState<Recipe[]>([]);
const [loading, setLoading] = useState(true);
const authFetch = useAuthFetch();
const apiClient = new ApiClient(authFetch);

useEffect(() => {
  const fetchRecipes = async () => {
    try {
      const data = await apiClient.getRecipes({ category: activeFilter === 'todas' ? undefined : activeFilter });
      setRecipes(data.recipes || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (session?.user?.id) fetchRecipes();
}, [session, activeFilter]);
```

**Task 4.3: Atualizar /metas/page.tsx**

Substituir `initialMetas` por `apiClient.getGoals()`.
Implementar handlers de create/update/delete com API calls.

**Task 4.4: Atualizar /atividades/page.tsx**

Substituir `initialActivities` por `apiClient.getActivities()`.
Implementar handlers de create/delete com API calls.

**Task 4.5: Atualizar /progresso/page.tsx**

Substituir arrays mockados por:
```typescript
const [summaryData, weightHistory, recent, macrosData] = await Promise.all([
  apiClient.getProgressSummary(),
  apiClient.getWeightHistory(7),
  apiClient.getRecentEntries(5),
  apiClient.getMacrosToday(),
]);
```

**Task 4.6: Atualizar /configuracoes/page.tsx**

Implementar `handleSave` com `apiClient.updateProfile()`.

**Task 4.7: Adicionar Loading States**

Para cada página, adicionar:
- Skeleton/spinner durante loading
- Error messages se falhar
- Empty states (já existem)

---

### FASE 5: TESTES E VALIDAÇÃO

**Task 5.1: Validação da Infraestrutura**

```bash
make dev
make ps
curl http://localhost:8000/docs
curl http://localhost:4111/health
curl http://localhost:3000
```

Verificar:
- [ ] Todos os 4 containers rodando
- [ ] Hot-reload funciona (editar arquivo e ver mudança)
- [ ] Logs sem erros críticos

**Task 5.2: Testes dos Endpoints do Catalog**

```bash
# Recipes
curl http://localhost:8000/api/v1/recipes
curl http://localhost:8000/api/v1/recipes/{id}

# Goals
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/goals

# Activities  
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/activities

# Tracking
curl -H "Authorization: Bearer {token}" http://localhost:8000/api/v1/tracking/summary
```

Verificar:
- [ ] Todos retornam 200 OK
- [ ] Formato JSON correto
- [ ] Dados são persistidos no banco

**Task 5.3: Testes do Backend (Tools + Rotas)**

```bash
# Login para obter token
TOKEN=$(curl -X POST http://localhost:4111/api/auth/login -d '{"email":"test@test.com","password":"test"}' | jq -r '.token')

# Testar rotas
curl -H "Authorization: Bearer $TOKEN" http://localhost:4111/api/recipes
curl -H "Authorization: Bearer $TOKEN" http://localhost:4111/api/goals
curl -H "Authorization: Bearer $TOKEN" http://localhost:4111/api/activities
curl -H "Authorization: Bearer $TOKEN" http://localhost:4111/api/tracking/summary
```

Verificar:
- [ ] JWT válido funciona
- [ ] JWT inválido retorna 401
- [ ] Tools chamam catalog corretamente

**Task 5.4: Testes do Frontend (E2E manual)**

1. Fazer login
2. Navegar para /receitas → Verificar que receitas reais aparecem
3. Navegar para /metas → Criar nova meta → Verificar que salva
4. Navegar para /atividades → Registrar atividade → Verificar que salva
5. Navegar para /progresso → Verificar que dashboard mostra dados reais
6. Navegar para /configuracoes → Atualizar nome → Verificar que salva

Verificar:
- [ ] Nenhum dado mockado aparece
- [ ] CRUD completo funciona
- [ ] Loading states aparecem
- [ ] Erros são tratados

**Task 5.5: Testes de Performance**

```bash
# Tempo de carregamento de páginas
time curl -s http://localhost:3000/receitas > /dev/null

# Logs de erro
make logs | grep -i error
```

Verificar:
- [ ] Páginas carregam em < 2s
- [ ] Sem erros nos logs (exceto warnings aceitáveis)

**Task 5.6: Validação de Segurança**

Verificar:
- [ ] .env não foi commitado
- [ ] Secrets não aparecem em logs
- [ ] Endpoints requerem autenticação (exceto /recipes públicos)
- [ ] SQL injection protection (SQLModel usa parametrização)

**Task 5.7: Documentação Final**

**Files:**
- Create: `docs/SETUP.md`

```markdown
# Setup do Projeto

## Pré-requisitos
- Docker e Docker Compose
- Make

## Setup Inicial

1. Clone o repositório
2. Copie `.env.example` para `.env`
3. Configure as variáveis em `.env`
4. Execute `make dev`

## Serviços

- Frontend: http://localhost:3000
- Backend: http://localhost:4111
- Catalog API: http://localhost:8000
- Catalog Docs: http://localhost:8000/docs

## Comandos Úteis

- `make dev` - Subir todos os serviços
- `make stop` - Parar todos os serviços
- `make logs-f` - Ver logs em tempo real
- `make clean` - Limpar tudo e recomeçar

## Troubleshooting

Ver docs/TROUBLESHOOTING.md
```

**Task 5.8: Commit Final**

```bash
git add .
git commit -m "feat: complete Docker Compose setup and catalog endpoints integration

- Add unified Docker Compose for all services
- Implement Recipe, Goal, Activity, Tracking endpoints in catalog
- Create Mastra tools for all endpoints
- Integrate frontend with backend API
- Replace all mocked data with real API calls
- Add comprehensive testing and documentation"
```

---

## Ordem de Execução Recomendada

1. **FASE 1** (Tasks 1.1-1.6): Infraestrutura Docker → ~2h
2. **FASE 2** (Tasks 2.1-2.20): Endpoints Catalog → ~6h
3. **FASE 3** (Tasks 3.1-3.24): Tools Mastra → ~4h
4. **FASE 4** (Tasks 4.1-4.7): Frontend Integration → ~3h
5. **FASE 5** (Tasks 5.1-5.8): Testes e Validação → ~2h

**Total estimado: ~17h de trabalho**

---

## Notas Importantes

### DRY (Don't Repeat Yourself)
- Services no catalog: lógica de negócio isolada
- Tools no Mastra: reuso entre agents e rotas
- API Client no frontend: centralize HTTP calls

### YAGNI (You Aren't Gonna Need It)
- Não adicione filtros/features não especificados
- Não crie abstrações prematuras
- Implemente apenas o necessário para substituir os mocks

### TDD (Test-Driven Development)
- Para cada endpoint do catalog, escrever teste primeiro
- Rodar teste (deve falhar)
- Implementar endpoint
- Rodar teste (deve passar)
- Commit

### Commits Frequentes
- Commit após cada task concluída
- Mensagens de commit semânticas:
  - `feat:` para novas features
  - `fix:` para correções
  - `refactor:` para refatorações
  - `test:` para testes
  - `docs:` para documentação
  - `chore:` para tarefas de manutenção

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Migration falha | Backup do banco antes de migrar, revisar SQL gerado |
| Hot-reload lento no macOS | Usar volumes nomeados, considerar Mutagen se muito lento |
| Conflito de portas | Documentar portas no README, verificar `make ps` |
| Secrets commitados | Pre-commit hook, revisar diffs antes de commit |
| Frontend quebra após mudanças | Testar cada página após integração |

---

## Próximos Passos

Após completar este plano:
1. ✅ Infraestrutura Docker funcionando
2. ✅ Todos os endpoints implementados
3. ✅ Frontend sem mocks
4. ✅ Testes passando
5. 🚀 Pronto para desenvolvimento de novas features!

