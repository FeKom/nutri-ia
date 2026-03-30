# Refactoring — Nutri-IA

Documento de referência para as principais dívidas técnicas da aplicação. O objetivo não é listar tudo que está errado, mas dar contexto de **por quê** cada área precisa mudar e **como** abordar isso sem quebrar o que já funciona.

---

## Contexto geral da arquitetura

O projeto é um monorepo com três apps que se comunicam via HTTP:

```
Frontend (Next.js)  →  Backend (Mastra/TypeScript)  →  Catalog (FastAPI/Python)
```

- **Frontend**: interface do usuário, chat, eval lab, planos alimentares
- **Backend**: agente de IA (Mastra), ferramentas de nutrição, autenticação JWT
- **Catalog**: banco de dados de alimentos (pgvector), serviço de embeddings, sistema de eval

Cada app tem suas próprias dependências e roda de forma independente. A comunicação entre eles é feita por chamadas HTTP — o que é bom para isolamento, mas cria um problema: **os tipos de dados e contratos de API estão duplicados em três lugares** (Zod no backend, Pydantic no catalog, inline no frontend).

---

## 1. URLs hardcoded em múltiplos arquivos

**Onde:** 10+ arquivos no frontend, `config.py` no catalog, `utils/user-profile-loader.ts` no backend.

**Problema concreto:**
```typescript
// apps/frontend/src/app/api/chat/route.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4111";

// apps/frontend/src/app/api/meal-plans/route.ts
const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

// apps/catalog/app/core/config.py
JWKS_URL: str = "http://localhost:3000/api/auth/jwks"
```

Cada arquivo redeclara a URL com um fallback diferente. O catalog tem a `JWKS_URL` (usada para validar JWTs) como string literal sem suporte a variável de ambiente — isso significa que mudar de ambiente exige editar código.

**Como corrigir:**
Criar um `apps/frontend/src/lib/config.ts` centralizado e importar de lá em todas as rotas. No catalog, expor `JWKS_URL` via `settings` em `config.py`. Nenhuma das mudanças é invasiva — é uma extração de constante.

---

## 2. Schemas e tipos definidos três vezes

**Onde:** `apps/backend/src/mastra/schemas/`, `apps/catalog/app/schemas/`, `apps/backend/src/mastra/clients/catalog-client.ts`

**Problema concreto:**
`UserProfile`, `MealPlan`, `TrackingEntry`, `Food` — cada um desses modelos existe em TypeScript (Zod), Python (Pydantic) e inline no `catalog-client.ts`. Quando um campo muda em um lugar, precisa ser atualizado nos outros dois manualmente. Isso já causou bugs silenciosos onde o frontend enviava um campo com nome diferente do que o catalog esperava.

**Como corrigir:**
A abordagem mais pragmática para esse stack é gerar os tipos TypeScript automaticamente a partir do OpenAPI spec do catalog. O FastAPI já gera o spec — basta rodar `openapi-typescript` no CI e commitar os tipos gerados. Isso elimina o `catalog-client.ts` como fonte de tipos e mantém Python como fonte da verdade para os contratos de API.

---

## 3. Ferramentas do agente sem registro claro

**Onde:** `apps/backend/src/mastra/agents/nutrition-analyst.ts`, `src/mastra/config/toolProcessor.ts`

**Problema concreto:**
O agente tem dois mecanismos de acesso a ferramentas ao mesmo tempo:
```typescript
tools: {
  create_user_profile: createUserProfileTool,  // 4 ferramentas estáticas
  update_user_profile: updateUserProfileTool,
  calculate_macros: calculateMacrosTool,
  create_meal_plan: createMealPlanTool,
},
inputProcessors: [toolSearch],  // + X ferramentas dinâmicas via toolSearch
```

Existem 20+ ferramentas em `src/mastra/tools/`, mas não fica claro quais estão disponíveis para o agente em runtime. O `toolSearch` (via `toolProcessor.ts`) faz a seleção dinâmica, mas sem documentação de como funciona. Quando algo não funciona, é difícil saber se o problema é na ferramenta ou no mecanismo de descoberta.

**Como corrigir:**
Criar um `tool-registry.ts` que exporta todas as ferramentas disponíveis com metadados (nome, descrição, quando usar). O `toolSearch` passa a consultar esse registro em vez de carregar ferramentas de forma implícita. Isso não muda o comportamento — só torna explícito o que já acontece.

---

## 4. Propagação de contexto de autenticação frágil

**Onde:** `apps/backend/src/mastra/index.ts`, `src/lib/async-context.ts`

**Problema concreto:**
O `userId` e o JWT são passados para as ferramentas de duas formas ao mesmo tempo: via `requestContext` do Mastra e via `AsyncLocalStorage`. O comentário no código explica por quê:

```typescript
// AsyncLocalStorage garante que userId/JWT propagam para as tools
// mesmo quando o requestContext do Mastra não é repassado internamente
return asyncContext.run({ userId, jwtToken: token }, async () => {
```

Ou seja, o `requestContext` não funcionou sozinho e o `AsyncLocalStorage` foi adicionado como fallback. Os dois mecanismos coexistem sem documentação de qual é o canônico. Ferramentas que acessam o contexto errado falham silenciosamente (retornam "usuário não encontrado" em vez de erro de autenticação).

**Como corrigir:**
Escolher um mecanismo e remover o outro. Documentar o padrão adotado. Adicionar um teste que verifica se uma ferramenta recebe o `userId` correto para evitar regressão.

---

## 5. Configuração de memória do agente desabilitada sem documentação

**Onde:** `apps/backend/src/mastra/config/memory.ts`

**Problema concreto:**
```typescript
workingMemory: { enabled: false },
// semanticRecall: { ... } — comentado
// embedder: ... — comentado
```

A memória semântica foi desabilitada (ou nunca chegou a funcionar) sem explicação. O agente mantém apenas as últimas 5 mensagens no contexto. Para conversas sobre planos alimentares semanais ou histórico nutricional, isso significa que o agente "esquece" o que foi dito algumas mensagens atrás.

**Como corrigir:**
Antes de reativar, documentar por que foi desabilitado (bug? custo? latência?). Se for custo/latência, configurar um limite de tokens em vez de desabilitar completamente. Se for bug, criar um issue com repro.

---

## 6. Rotas de API do frontend sem validação de entrada

**Onde:** `apps/frontend/src/app/api/*/route.ts`

**Problema concreto:**
As rotas do Next.js fazem proxy das chamadas para o backend sem validar o body da requisição. O backend valida, mas erros chegam ao frontend como respostas 500 genéricas em vez de 400 com mensagem útil.

```typescript
// Atual — nenhuma validação
const { messages } = await c.req.json();

// Ideal — validação com Zod antes de passar adiante
const { messages } = ChatRequestSchema.parse(await c.req.json());
```

**Como corrigir:**
Adicionar schemas Zod nas rotas do frontend que recebem input do usuário (`/api/chat`, `/api/eval/experiments`). As rotas que são só proxy puro (passam tudo para o backend) não precisam de validação.

---

## 7. Logging inconsistente no backend

**Onde:** `apps/backend/src/mastra/index.ts` e ferramentas diversas

**Problema concreto:**
O backend configura Pino como logger, mas vários trechos usam `console.log` diretamente:
```typescript
console.log("📥 Mastra received:", JSON.stringify({...}));
console.error("❌ JWT verification failed:", err);
```

`console.log` não é capturado pela configuração do Pino (level, output format, contexto estruturado). Em produção, esses logs aparecem sem timestamp, sem request ID, e sem os campos estruturados que facilitam busca no Datadog/CloudWatch.

**Como corrigir:**
Substituir `console.log/error` pelo `logger` do Mastra nas partes críticas do `index.ts`. Nas ferramentas, o pattern já está correto — é só o `index.ts` que mistura os dois.

---

## 8. Busca de alimentos: vetor puro sem componente léxico

**Onde:** `apps/catalog/app/services/food_service.py`, `search_foods_by_embedding`

**Problema concreto:**
A busca semântica usa exclusivamente pgvector (cosine distance). Isso funciona bem para queries como "frango grelhado" ou "feijão preto", mas falha para nomes curtos com modificadores de preparo comuns. Exemplo real:

```
Query: "ovo cozido"
Resultado 1: Pinhão, cozido     (0.899)  ← errado
Resultado 2: Brócolis, cozido   (0.896)  ← errado
...
Resultado N: Ovo, de galinha, cozido  ← correto, mas fora do top-5
```

O modelo E5-small dá o mesmo peso a todos os tokens. "Pinhão cozido" tem 2 tokens — "cozido" representa 50% do embedding. "Ovo de galinha inteiro cozido" tem 5 tokens — "cozido" pesa menos. Resultado: alimentos com descrição curta + o mesmo modificador de preparo pontuam mais alto.

**Como corrigir:**
Busca híbrida: combinar pgvector com busca textual (`pg_trgm` ou `to_tsvector` do PostgreSQL). Para cada resultado do vetor, somar um bônus se o nome do alimento contém tokens da query. Score final = `0.85 * vec_similarity + 0.15 * text_match`. Isso não exige mudança de schema — `pg_trgm` já está disponível no PostgreSQL com pgvector.

---

## Prioridades sugeridas

| # | Item | Impacto | Esforço | Por onde começar |
|---|------|---------|---------|-----------------|
| 1 | Busca híbrida (vetor + texto) | Alto — afeta qualidade do chat | Baixo | `food_service.py` |
| 2 | URLs hardcoded | Alto — bloqueia deploy | Baixo | `frontend/lib/config.ts` |
| 3 | Validação nas rotas do frontend | Médio — melhora DX | Baixo | rotas de `/api/eval` |
| 4 | Tipos gerados do OpenAPI | Alto — elimina drift de schemas | Médio | CI + `openapi-typescript` |
| 5 | Registry de ferramentas | Médio — melhora debugabilidade | Médio | `tool-registry.ts` |
| 6 | Contexto de auth (escolher um) | Alto — bugs silenciosos | Baixo | `index.ts` + `async-context.ts` |
| 7 | Logging consistente | Baixo — qualidade de vida | Baixo | substituições pontuais |
| 8 | Memória do agente | Alto — qualidade do chat | Alto | depende de investigação |
