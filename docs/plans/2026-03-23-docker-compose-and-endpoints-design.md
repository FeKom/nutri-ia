# Docker Compose Unificado e Endpoints do Catalog - Design Document

**Data:** 2026-03-23
**Autor:** Claude Sonnet 4.5
**Status:** Aprovado

## Objetivo

Implementar infraestrutura Docker Compose unificada para subir os 3 serviços (frontend, backend, catalog) com um único comando, e completar os endpoints faltantes no catalog para substituir dados mockados no frontend.

## Contexto

### Estado Atual
- **Frontend**: Next.js sem Docker, dados mockados em várias páginas
- **Backend**: Mastra.ai com Dockerfile, sem docker-compose
- **Catalog**: FastAPI com Dockerfile + docker-compose próprio (apenas Postgres)
- Makefile na raiz com comandos incompletos

### Páginas com Dados Mockados
1. `/receitas` - Array `mockRecipes`
2. `/metas` - Array `initialMetas`
3. `/atividades` - Array `initialActivities`
4. `/progresso` - Arrays `weightData` e `recentEntries`
5. `/configuracoes` - TODO para atualizar perfil

### Páginas Funcionais
- `/dietas` - Já chama API do backend ✅
- `/chat` - Usa agents IA ✅

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                     (Next.js - :3000)                        │
│                                                              │
│  Chamadas HTTP → Backend                                    │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Mastra)                        │
│                    (Node.js - :4111)                         │
│                                                              │
│  Orquestrador: Agents + Tools                               │
│  Tools chamam → Catalog                                     │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Catalog (FastAPI)                          │
│                    (Python - :8000)                          │
│                                                              │
│  Endpoints de dados: receitas, metas, atividades, tracking  │
└──────────────────────┬───────────────────────────────────────┘
                       │ PostgreSQL
                       ▼
                  ┌──────────┐
                  │ Postgres │
                  │  :5432   │
                  └──────────┘
```

### Fluxo de Dados
- Frontend só conversa com Backend
- Backend usa Tools para chamar Catalog
- Catalog acessa diretamente o Postgres
- Rede Docker interna: `nutria-network`

## Infraestrutura Docker

### Estrutura de Arquivos

```
/Users/vinic/nutri-ia/
├── docker-compose.yml          # Novo: orquestra os 4 serviços
├── .env.example                # Novo: template de variáveis
├── .env                        # Local, não commitado
├── Makefile                    # Atualizar: comandos unificados
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile          # Novo: build Next.js
│   │   └── package.json
│   ├── backend/
│   │   ├── Dockerfile          # Atualizar: multi-stage
│   │   └── package.json
│   └── catalog/
│       ├── Dockerfile          # Já existe ✅
│       ├── docker-compose.yml  # Manter para dev local
│       └── Makefile            # Manter
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./apps/catalog/docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nutria-network

  catalog:
    build:
      context: ./apps/catalog
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    volumes:
      - ./apps/catalog:/app
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - nutria-network
    command: sh -c "alembic upgrade head && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

  backend:
    build:
      context: ./apps/backend
      dockerfile: Dockerfile
      target: dev
    ports:
      - "4111:4111"
    environment:
      CATALOG_API_URL: http://catalog:8000
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    volumes:
      - ./apps/backend:/app
      - /app/node_modules
    depends_on:
      - catalog
    networks:
      - nutria-network
    command: pnpm dev

  frontend:
    build:
      context: ./apps/frontend
      dockerfile: Dockerfile
      target: dev
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_BACKEND_URL: http://localhost:4111
    volumes:
      - ./apps/frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    networks:
      - nutria-network
    command: pnpm dev

volumes:
  postgres_data:

networks:
  nutria-network:
    driver: bridge
```

### Makefile (Raiz)

```makefile
.PHONY: help dev build stop clean logs restart

help:
	@echo "Nutri-IA - Comandos Docker"
	@echo ""
	@echo "  make dev        - Sobe todos os serviços em desenvolvimento"
	@echo "  make build      - Rebuilda as imagens Docker"
	@echo "  make stop       - Para todos os serviços"
	@echo "  make restart    - Reinicia todos os serviços"
	@echo "  make logs       - Mostra logs de todos os serviços"
	@echo "  make logs-f     - Mostra logs em follow mode"
	@echo "  make clean      - Remove containers, volumes e imagens"
	@echo "  make ps         - Lista serviços rodando"

dev:
	@echo "🚀 Subindo todos os serviços..."
	docker-compose up -d
	@echo "✅ Serviços disponíveis:"
	@echo "   Frontend:  http://localhost:3000"
	@echo "   Backend:   http://localhost:4111"
	@echo "   Catalog:   http://localhost:8000"
	@echo "   Postgres:  localhost:5432"

build:
	@echo "🔨 Rebuilding imagens..."
	docker-compose build

stop:
	@echo "🛑 Parando serviços..."
	docker-compose down

restart: stop dev

logs:
	docker-compose logs --tail=100

logs-f:
	docker-compose logs -f

clean:
	@echo "🧹 Limpando containers, volumes e imagens..."
	docker-compose down -v --rmi local
	rm -rf apps/frontend/node_modules apps/backend/node_modules
	rm -rf apps/frontend/.next apps/backend/dist

ps:
	docker-compose ps
```

### .env.example

```bash
# Database
POSTGRES_USER=nutriauser
POSTGRES_PASSWORD=changeme
POSTGRES_DB=nutriadb

# APIs
CATALOG_API_URL=http://catalog:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4111

# Authentication
BETTER_AUTH_SECRET=generate_random_secret_here_min_32_chars
BETTER_AUTH_URL=http://localhost:4111

# OpenAI
OPENAI_API_KEY=sk-your-openai-key-here
```

### Dockerfiles

**apps/frontend/Dockerfile**:
```dockerfile
FROM node:20-slim AS dev
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
EXPOSE 3000
CMD ["pnpm", "dev"]
```

**apps/backend/Dockerfile** (atualizar):
```dockerfile
FROM node:20-slim AS dev
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
EXPOSE 4111
CMD ["pnpm", "dev"]

# Production stage mantém o existente
```

## Endpoints do Catalog

### Novos Arquivos

```
apps/catalog/
├── app/
│   ├── api/v1/
│   │   ├── recipes.py      # Novo
│   │   ├── goals.py        # Novo
│   │   ├── activities.py   # Novo
│   │   └── tracking.py     # Atualizar
│   ├── models/
│   │   ├── recipe.py       # Novo
│   │   ├── goal.py         # Novo
│   │   └── activity.py     # Novo
│   ├── schemas/
│   │   ├── recipe.py       # Novo
│   │   ├── goal.py         # Novo
│   │   └── activity.py     # Novo
│   └── services/
│       ├── recipe_service.py   # Novo
│       ├── goal_service.py     # Novo
│       └── activity_service.py # Novo
```

### 1. Receitas (`/api/v1/recipes`)

**Endpoints**:
- `GET /api/v1/recipes` - Listar receitas (com filtros)
- `GET /api/v1/recipes/{recipe_id}` - Detalhes de uma receita
- `POST /api/v1/recipes/search` - Busca com filtros avançados

**Modelo**:
```python
class Recipe:
    id: UUID
    name: str
    description: str
    category: str  # cafe-da-manha, almoco, jantar, lanche
    prep_time_minutes: int
    difficulty: str  # facil, medio, dificil
    calories: int
    protein_g: float
    carbs_g: float
    fat_g: float
    ingredients: List[str]
    instructions: Optional[str]
    created_at: datetime
```

### 2. Metas (`/api/v1/goals`)

**Endpoints**:
- `GET /api/v1/goals` - Listar metas do usuário
- `POST /api/v1/goals` - Criar nova meta
- `GET /api/v1/goals/{goal_id}` - Detalhes de uma meta
- `PUT /api/v1/goals/{goal_id}` - Atualizar meta
- `DELETE /api/v1/goals/{goal_id}` - Deletar meta

**Modelo**:
```python
class Goal:
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str]
    target_value: float
    current_value: float
    unit: str
    category: str  # peso, nutricao, atividade
    deadline: Optional[date]
    created_at: datetime
    updated_at: datetime
```

### 3. Atividades (`/api/v1/activities`)

**Endpoints**:
- `GET /api/v1/activities` - Listar atividades
- `POST /api/v1/activities` - Registrar atividade
- `GET /api/v1/activities/{activity_id}` - Detalhes
- `DELETE /api/v1/activities/{activity_id}` - Deletar
- `GET /api/v1/activities/stats` - Estatísticas

**Modelo**:
```python
class Activity:
    id: UUID
    user_id: UUID
    type: str  # caminhada, corrida, musculacao, etc
    duration_minutes: int
    calories_burned: int
    date: date
    notes: Optional[str]
    created_at: datetime
```

### 4. Tracking (`/api/v1/tracking`)

**Endpoints**:
- `GET /api/v1/tracking/summary` - Dashboard summary
- `GET /api/v1/tracking/weight-history` - Histórico de peso
- `POST /api/v1/tracking/weight` - Registrar peso
- `GET /api/v1/tracking/recent-entries` - Histórico recente
- `GET /api/v1/tracking/macros-today` - Macros do dia

**Modelos**:
```python
class WeightEntry:
    id: UUID
    user_id: UUID
    weight_kg: float
    date: date
    created_at: datetime

class TrackingSummary:
    current_weight_kg: float
    weight_change_kg: float
    calories_today: int
    calories_target: int
    protein_today_g: float
    protein_target_g: float
    carbs_today_g: float
    carbs_target_g: float
    fat_today_g: float
    fat_target_g: float
    activities_this_week: int
    activities_target: int
```

### 5. User Profile

**Endpoint**:
- `PUT /api/v1/users/{user_id}/profile` - Atualizar perfil

## Tools do Mastra (Backend)

### Novos Tools (15 total)

```
apps/backend/src/mastra/tools/
├── get-recipes.ts
├── search-recipes.ts
├── create-goal.ts
├── update-goal.ts
├── list-goals.ts
├── delete-goal.ts
├── log-activity.ts
├── list-activities.ts
├── delete-activity.ts
├── get-activity-stats.ts
├── get-progress-summary.ts
├── get-weight-history.ts
├── log-weight.ts
├── get-recent-entries.ts
└── get-macros-today.ts
```

### Estrutura de um Tool

```typescript
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { catalogClient } from '../clients/catalog-client';

export const getRecipesTool = createTool({
  id: 'get-recipes',
  description: 'Get a list of recipes with optional filters',
  inputSchema: z.object({
    category: z.enum(['cafe-da-manha', 'almoco', 'jantar', 'lanche']).optional(),
    difficulty: z.enum(['facil', 'medio', 'dificil']).optional(),
    maxCalories: z.number().optional(),
    minProtein: z.number().optional(),
    limit: z.number().default(20),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    recipes: z.array(z.any()),
    count: z.number(),
  }),
  execute: async ({ context, input }) => {
    const userId = context.userId;

    const params = new URLSearchParams();
    if (input.category) params.append('category', input.category);
    if (input.difficulty) params.append('difficulty', input.difficulty);
    if (input.maxCalories) params.append('max_calories', input.maxCalories.toString());
    if (input.minProtein) params.append('min_protein', input.minProtein.toString());
    params.append('limit', input.limit.toString());

    const response = await catalogClient.get(`/api/v1/recipes?${params}`);
    return response.data;
  },
});
```

### Rotas do Backend

```
apps/backend/src/routes/
├── recipes.ts        # Novo
├── goals.ts          # Novo
├── activities.ts     # Novo
├── tracking.ts       # Novo
└── index.ts
```

### Autenticação

```typescript
// Middleware JWT (better-auth)
router.use('/api/*', async (req, res, next) => {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = session.user;
  next();
});
```

## Atualizações no Frontend

### API Client

```typescript
// apps/frontend/src/lib/api-client.ts
export class ApiClient {
  async getRecipes(params) { ... }
  async getGoals() { ... }
  async createGoal(goal) { ... }
  async updateGoal(id, updates) { ... }
  async deleteGoal(id) { ... }
  async getActivities(params) { ... }
  async logActivity(activity) { ... }
  async deleteActivity(id) { ... }
  async getProgressSummary() { ... }
  async getWeightHistory(days) { ... }
  async updateProfile(updates) { ... }
}
```

### Mudanças por Página

**1. `/receitas`**: Substituir `mockRecipes` por `apiClient.getRecipes()`
**2. `/metas`**: Substituir `initialMetas` por `apiClient.getGoals()`
**3. `/atividades`**: Substituir `initialActivities` por `apiClient.getActivities()`
**4. `/progresso`**: Substituir arrays mockados por `apiClient.getProgressSummary()`
**5. `/configuracoes`**: Implementar `apiClient.updateProfile()`

### Estados de Loading

Todas as páginas terão:
- Loading state (skeleton/spinner)
- Error state (mensagem de erro)
- Empty state (já existe)

## Segurança

### Variáveis de Ambiente

**NUNCA commitar**:
- `.env`
- Qualquer arquivo com secrets/tokens
- Logs com dados sensíveis

**Sempre commitar**:
- `.env.example` (sem valores reais)

### Validação

**Catalog (Python)**:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_URL: str
```

**Backend (TypeScript)**:
```typescript
const envSchema = z.object({
  CATALOG_API_URL: z.string().url(),
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string().min(1),
});

export const config = envSchema.parse(process.env);
```

## Testes e Validação

### Checklist

**Fase 1: Infraestrutura**
- [ ] `make dev` sobe os 4 serviços
- [ ] Postgres healthcheck passa
- [ ] Catalog responde em :8000
- [ ] Backend responde em :4111
- [ ] Frontend carrega em :3000
- [ ] Hot-reload funciona

**Fase 2: Catalog Endpoints**
- [ ] Todos os endpoints de receitas funcionam
- [ ] Todos os endpoints de metas funcionam
- [ ] Todos os endpoints de atividades funcionam
- [ ] Endpoints de tracking retornam dados corretos

**Fase 3: Backend Tools**
- [ ] Tools chamam catalog corretamente
- [ ] Autenticação funciona (JWT)

**Fase 4: Frontend Integration**
- [ ] Todas as páginas carregam dados reais
- [ ] CRUD de metas funciona
- [ ] CRUD de atividades funciona
- [ ] Atualização de perfil funciona

**Fase 5: End-to-End**
- [ ] Fluxo completo funciona
- [ ] Sem secrets em logs
- [ ] Performance aceitável

### Comandos de Teste

```bash
# Health check
curl http://localhost:8000/health
curl http://localhost:4111/health

# Ver logs
make logs-f

# Status dos containers
make ps
```

## Ordem de Implementação

1. **Infraestrutura**: Docker Compose + Makefiles + Dockerfiles
2. **Mapeamento**: Analisar frontend e documentar endpoints necessários
3. **Catalog**: Implementar todos os endpoints
4. **Mastra**: Criar todos os tools
5. **Frontend**: Substituir mocks por API calls
6. **Testes**: Validar end-to-end

## Decisões Técnicas

### Por que Docker Compose Unificado?
- Isolamento completo
- Ambiente reproduzível
- Fácil onboarding de novos devs
- Próximo ao ambiente de produção

### Por que Backend como Orquestrador?
- Centralização da lógica de negócio
- Agents têm acesso aos dados
- Mais seguro (frontend não expõe catalog)
- Facilita cache e otimizações futuras

### Por que Hot-Reload com Volumes?
- Desenvolvimento mais rápido
- Não precisa rebuild a cada mudança
- Trade-off: um pouco mais lento no macOS, mas aceitável

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Performance do hot-reload no macOS | Médio | Usar volumes nomeados, otimizar watchman |
| Conflito de portas locais | Baixo | Documentar portas no README |
| Secrets commitados acidentalmente | Alto | .gitignore + pre-commit hooks |
| Mudanças quebram frontend | Médio | Testes E2E + versionamento de API |

## Próximos Passos

Após aprovação deste design:
1. Invocar skill `writing-plans` para criar plano de implementação detalhado
2. Executar implementação fase por fase
3. Validar cada fase antes de prosseguir
