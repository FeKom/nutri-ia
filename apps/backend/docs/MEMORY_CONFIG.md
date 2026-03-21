# Configuração de Memory - Nutrition AI

## 📋 Visão Geral

O sistema usa uma **abordagem híbrida** de memory que combina:

1. **user_profile** (Banco de dados) - Dados oficiais e validados
2. **Working Memory** (Mastra) - Aprendizados dinâmicos do agente
3. **Message History** (Mastra) - Conversas recentes
4. **Semantic Recall** (Mastra) - Busca semântica em histórico

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                  NUTRITION AGENT                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐      ┌────────────────────────┐ │
│  │ user_profile │◄─────┤ Injetado via context   │ │
│  │ (Banco SQL)  │      │ (dados oficiais)       │ │
│  └──────────────┘      └────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │         MASTRA MEMORY SYSTEM                  │ │
│  ├───────────────────────────────────────────────┤ │
│  │                                               │ │
│  │  1️⃣  Message History (últimas 15 msgs)      │ │
│  │  2️⃣  Semantic Recall (top 5 relevantes)     │ │
│  │  3️⃣  Working Memory (aprendizados)          │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Diferenças entre user_profile e Working Memory

| Aspecto | user_profile (Banco) | Working Memory (Mastra) |
|---------|---------------------|------------------------|
| **Fonte** | Formulário/cadastro do usuário | Conversas com o agente |
| **Controle** | Aplicação/backend | Agente LLM |
| **Tipo de Dado** | Estruturado (SQL) | Texto livre (Markdown) |
| **Frequência de mudança** | Raro (quando usuário atualiza) | Frequente (a cada conversa) |
| **Exemplos** | Nome, alergias, meta calórica | "Prefere café rápido", "Dificuldade com proteína" |
| **Confiabilidade** | Alta (validado) | Média (aprendido pelo LLM) |
| **Usado para** | Regras de negócio, validações | Personalização, contexto |

---

## ⚙️ Configuração Atual

### Arquivo: `src/mastra/config/memory.ts`

```typescript
Memory({
  // Storage: LibSQLStore (file-based ou Turso remoto)
  storage: new LibSQLStore({
    url: process.env.MASTRA_STORAGE_URL || "file:./nutrition-memory.db"
  }),

  // Vector DB: LibSQLVector (para semantic recall)
  vector: new LibSQLVector({
    connectionUrl: process.env.MASTRA_VECTOR_URL || "file:./nutrition-vector.db"
  }),

  // Embedder: OpenAI text-embedding-3-small
  embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),

  options: {
    lastMessages: 15,              // Message history
    semanticRecall: {              // Semantic search
      topK: 5,
      messageRange: 2,
      scope: "resource"
    },
    workingMemory: {               // Aprendizados do agente
      enabled: true,
      scope: "resource"
    },
    threads: {
      generateTitle: {             // Títulos automáticos
        model: "github-models/openai/gpt-4o-mini",
        instructions: "Gere um título curto (máximo 6 palavras) que resuma o tema principal desta conversa sobre nutrição"
      }
    }
  }
})
```

---

## 💡 Como Usar

### 1. Carregar user_profile do banco

```typescript
import { getUserProfileFromDB, userProfileToContext } from "./utils/user-profile-loader";

const userId = "user-123";
const profile = await getUserProfileFromDB(userId);
const profileContext = userProfileToContext(profile);
```

### 2. Chamar o agente com memory + context

```typescript
const response = await nutritionAnalystAgent.generate(userMessage, {
  // Memory (automático)
  memory: {
    thread: `nutrition-${userId}`,
    resource: userId,
  },

  // Context (user_profile do banco)
  context: [profileContext],
});
```

---

## 📁 Arquivos Criados

```
src/mastra/
├── config/
│   └── memory.ts              # Configuração de Memory
├── agents/
│   └── nutrition-analyst.ts   # Agent com memory configurado
└── utils/
    └── user-profile-loader.ts # Helper para user_profile
```

---

## 🔧 Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# LibSQL para Mastra Memory
# Opção 1: File-based (desenvolvimento local - padrão)
MASTRA_STORAGE_URL=file:./nutrition-memory.db
MASTRA_VECTOR_URL=file:./nutrition-vector.db

# Opção 2: Turso remoto (produção)
# MASTRA_STORAGE_URL=libsql://[name].turso.io
# MASTRA_VECTOR_URL=libsql://[name]-vector.turso.io

# GitHub Token (para LLM e embeddings)
GITHUB_TOKEN=seu_token_aqui
```

### 🔍 OpenAI text-embedding-3-small

O modelo de embedding usado:
- Modelo: `openai/text-embedding-3-small`
- Acesso via OpenAI API (usa OPENAI_API_KEY ou GITHUB_TOKEN)
- Dimensões: 1536
- Eficiente e de alta qualidade

### 📝 Nota sobre PostgreSQL

Para migrar para PostgreSQL + PgVector no futuro:
1. Atualizar `@mastra/core` para versão 1.x (atualmente em 0.24.9)
2. Instalar `@mastra/pg` compatível
3. Substituir `LibSQLStore/LibSQLVector` por `PostgresStore/PgVector`
4. Usar `fastembed` para consistência com o Catalog API

---

## 📝 Exemplo Completo de Uso

```typescript
// src/mastra/index.ts - endpoint /chat

registerApiRoute('/chat', {
  method: 'POST',
  handler: async (c) => {
    const { messages } = await c.req.json();
    const userId = c.req.header('X-User-Id');

    // 1. Busca perfil oficial do banco
    const userProfile = await getUserProfileFromDB(userId);
    const profileContext = userProfileToContext(userProfile);

    // 2. Usa agente com memory + context
    const stream = await nutritionAgent.stream(messages, {
      memory: {
        thread: `nutrition-${userId}`,
        resource: userId,
      },
      context: [profileContext],
    });

    return stream.toUIMessageStreamResponse();
  },
});
```

---

## 🎯 Benefícios da Abordagem Híbrida

✅ **user_profile** garante dados oficiais e confiáveis
✅ **Working Memory** permite personalização dinâmica
✅ **Message History** mantém contexto da conversa
✅ **Semantic Recall** recupera informações antigas relevantes

---

## 🚀 Próximos Passos

1. ✅ Memory configurada
2. ✅ Agent atualizado
3. ⏳ Implementar `getUserProfileFromDB` com seu banco real
4. ⏳ Atualizar endpoint `/chat` para usar `context`
5. ⏳ Testar semantic recall com conversas reais

---

## 📚 Documentação Mastra

- [Message History](https://mastra.ai/docs/memory/message-history)
- [Semantic Recall](https://mastra.ai/docs/memory/semantic-recall)
- [Working Memory](https://mastra.ai/docs/memory/working-memory)
- [Memory Processors](https://mastra.ai/docs/memory/memory-processors)
