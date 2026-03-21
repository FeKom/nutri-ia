# Communication: Frontend <-> Backend

Contrato de comunicacao entre o nutria-frontend (Next.js) e o nutria-backend (Mastra/Hono).

## Arquitetura

```
Browser -> Frontend (Next.js:3000) -> Backend (Mastra/Hono:4111) -> Catalog (FastAPI:8000)
                                  |                               |
                                  +--- API Routes (proxy) --------+--- catalog-client.ts
                                  +--- Chat (SSE) ----------------+--- /chat endpoint
```

- **Frontend** roda em `localhost:3000` (Next.js App Router)
- **Backend** roda em `localhost:4111` (Mastra framework com Hono server)
- Variaveis de ambiente:
  - Frontend: `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:4111`)
  - Frontend: `CATALOG_API_URL` (default `http://localhost:8000`) - para rotas que proxeiam direto ao catalog
  - Backend: `FRONTEND_URL` (default `http://localhost:3000`) - para CORS

## Auth Flow

### Better Auth (backend)

O backend roda Better Auth com plugin JWT (EdDSA/Ed25519).

```
1. Frontend chama POST /auth/sign-up/email ou POST /auth/sign-in/email
2. Better Auth cria sessao e retorna session cookie
3. Frontend chama POST /auth/token (jwt plugin) para obter JWT
4. JWT usado em todas as chamadas subsequentes via Authorization header
```

**Better Auth config** (`src/lib/auth.ts`):
- Algoritmo: EdDSA (Ed25519) via JWKS
- JWT expira em 15 minutos
- Session expira em 7 dias
- JWT payload: `{ sub: userId, email, name }`
- Issuer: `BACKEND_URL` (http://localhost:4111)
- Audience: "nutria"
- Rate limit: 10 requests/60s nos endpoints de auth

**JWT verification** (`src/lib/jwt-auth.ts`):
- Usa `jose` library com `createRemoteJWKSet`
- JWKS endpoint: `{BACKEND_URL}/auth/jwks`
- Verifica issuer e audience

### Auth endpoints (Better Auth, registrados como API routes do Mastra)

```
ALL /auth/* -> auth.handler(c.req.raw)
```

Principais endpoints providos pelo Better Auth:
- `POST /auth/sign-up/email` - Cadastro com email/senha
- `POST /auth/sign-in/email` - Login com email/senha
- `POST /auth/sign-out` - Logout
- `GET /auth/session` - Verifica sessao ativa
- `POST /auth/token` - Gera JWT (plugin jwt)
- `GET /auth/jwks` - Public JWKS para verificacao de JWT

### JWT Propagation

```
Frontend -> Authorization: Bearer <jwt> -> Next.js API Route -> Authorization: Bearer <jwt> -> Backend/Catalog
```

O JWT e propagado em todos os requests:
1. Frontend inclui `Authorization: Bearer <token>` em cada request
2. Next.js API routes proxeiam o header para o backend/catalog
3. Backend extrai userId do JWT (`verifyJwt()`) e configura no `AsyncLocalStorage`
4. Tools do agente acessam via `asyncContext.getStore()?.jwtToken`

## Chat Endpoint (SSE Stream)

### Frontend -> Backend: `POST /api/chat`

O frontend tem uma API route que proxeia para o backend Mastra.

**Frontend API Route** (`src/app/api/chat/route.ts`):

```typescript
// POST: Envia mensagem e recebe SSE stream
POST /api/chat

// Request (body) - formato AI SDK
{
  id?: string,
  messages: Array<{
    role: "user" | "assistant",
    parts: Array<{
      type: "text",
      text: string
    } | {
      type: "file",
      url: string,       // data URL (base64)
      mediaType: string   // e.g. "image/jpeg"
    }>
  }>,
  trigger?: string  // default "submit-message"
}

// O frontend converte para formato Mastra:
{
  id: string,
  messages: Array<{
    role: string,
    content: Array<{
      type: "text" | "file",
      text?: string,
      data?: string,        // URL para files
      mediaType?: string
    }>
  }>,
  trigger: string
}

// Response: text/event-stream (SSE)
// Headers: Content-Type: text/event-stream, Cache-Control: no-cache
```

**Backend /chat endpoint** (`src/mastra/index.ts`):
1. Valida JWT do header Authorization
2. Carrega perfil do usuario (`getUserProfileFromDB`)
3. Injeta contexto do perfil como system message
4. Configura `requestContext` com userId e threadId
5. Roda dentro de `asyncContext.run()` para propagar userId/JWT para tools
6. Usa `nutritionAnalystAgent.stream(messages, { context, requestContext })`
7. Converte stream Mastra -> AI SDK via `toAISdkStream`
8. Retorna `createUIMessageStreamResponse`

### Frontend -> Backend: `GET /api/chat`

Busca historico de mensagens.

```typescript
GET /api/chat
Authorization: Bearer <jwt>

// Proxeia para:
GET {BACKEND_URL}/agents/nutri-ia/memory?threadId=chat-{userId}&resourceId={userId}

// Response: array de mensagens ou []
```

## Meal Plans (Proxy Routes)

O frontend proxeia diretamente para o Catalog API (nao passa pelo backend Mastra).

### `GET /api/meal-plans`
Lista planos com paginacao.
```
Query: ?page=1&page_size=10
Proxeia -> GET {CATALOG_API_URL}/api/v1/meal-plans?page={page}&page_size={page_size}
```

### `POST /api/meal-plans`
Cria plano alimentar.
```
Body: MealPlanCreate
Proxeia -> POST {CATALOG_API_URL}/api/v1/meal-plans
```

### `GET /api/meal-plans/{id}`
Busca plano por ID.
```
Proxeia -> GET {CATALOG_API_URL}/api/v1/meal-plans/{id}
```

### `PUT /api/meal-plans/{id}`
Atualiza plano.
```
Body: MealPlanUpdate
Proxeia -> PUT {CATALOG_API_URL}/api/v1/meal-plans/{id}
```

### `DELETE /api/meal-plans/{id}`
Deleta plano.
```
Proxeia -> DELETE {CATALOG_API_URL}/api/v1/meal-plans/{id}
Response: 204 No Content
```

### `GET /api/meal-plans/{id}/pdf`
Exporta PDF do plano.
```
Proxeia -> GET {CATALOG_API_URL}/api/v1/meal-plans/{id}/pdf
Response: application/pdf (binary stream)
```

## Padroes

### Headers em todos os requests
```
Content-Type: application/json
Authorization: Bearer <jwt>
```

### Erro padrao
```json
{ "error": "Mensagem de erro" }
```
Status codes: 401 (Unauthorized), 500 (Internal Server Error)

### CORS
Backend configura CORS para aceitar requests do frontend:
```typescript
cors: {
  origin: [FRONTEND_URL],  // http://localhost:3000
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "x-mastra-client-type"],
}
```

## Paginas do Frontend

```
/              - Landing/Dashboard
/login         - Login
/register      - Cadastro
/chat          - Chat com agente AI (SSE)
/dietas        - Listagem de planos alimentares
/progresso     - Progresso nutricional
/metas         - Metas nutricionais
/configuracoes - Configuracoes do perfil
/receitas      - Receitas
/atividades    - Atividades fisicas
```

## AsyncLocalStorage (Backend)

O backend usa `AsyncLocalStorage` para propagar contexto do usuario para as tools do agente:

```typescript
// src/lib/async-context.ts
interface RequestContext {
  userId: string;
  jwtToken?: string;
}

// Uso nas tools:
import { getCurrentUserId, getCurrentJwtToken } from "../../lib/async-context";
const userId = getCurrentUserId();    // retorna userId ou "anonymous"
const token = getCurrentJwtToken();   // retorna JWT ou undefined
```

Isso permite que qualquer tool do Mastra acesse userId e JWT sem precisar receber como parametro.
