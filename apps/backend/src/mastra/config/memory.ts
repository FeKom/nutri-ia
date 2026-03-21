/**
 * Configuração de Memory para o Nutrition Analyst
 *
 * Abordagem Híbrida:
 * 1. Message History: Conversas recentes
 * 2. Semantic Recall: Busca em histórico antigo
 * 3. Working Memory: Insights e preferências aprendidas
 * 4. user_profile (Banco de dados): Dados oficiais injetados via context
 *
 * Tecnologias utilizadas:
 * - LibSQL para storage e vector database
 * - GitHub Models text-embedding-3-small para embeddings
 *
 * Nota: Migração futura para PostgreSQL + PgVector (alinhado com Catalog API)
 * requer atualização do @mastra/core para versão 1.x
 */

import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { sharedStorage } from './storage';
// import { LibSQLVector } from "@mastra/libsql";
// import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

/**
 * Cria instância de Memory otimizada para aplicação nutricional
 *
 * Tecnologias utilizadas:
 * - LibSQL para storage e vector database
 * - GitHub Models text-embedding-3-small para embeddings
 *
 * Nota: Para usar PostgreSQL + PgVector no futuro, será necessário
 * atualizar @mastra/core para versão 1.x (atualmente em 0.24.9)
 */
export function createNutritionMemory() {
  // URLs do LibSQL (file-based)
  const storageUrl = process.env.MASTRA_STORAGE_URL || "file:./nutrition-memory.db";
  // const vectorUrl = process.env.MASTRA_VECTOR_URL || "file:./nutrition-vector.db";

  return new Memory({
    // 📦 Storage: LibSQL para message storage
    storage: sharedStorage,

    // 🔍 Vector store: LibSQL Vector para semantic search (comentado por enquanto)
    // vector: new LibSQLVector({
    //   connectionUrl: vectorUrl,
    // }),

    // 🧮 Embedding: Comentado por enquanto - adicione quando tiver OPENAI_API_KEY
    // embedder: new ModelRouterEmbeddingModel("openai/text-embedding-3-small"),

    options: {
      // 1️⃣ MESSAGE HISTORY: Últimas conversas (reduzido para evitar ultrapassar limite de tokens)
      lastMessages: 5,

      // 2️⃣ SEMANTIC RECALL: Desabilitado (requer embedder)
      // semanticRecall: {
      //   topK: 5,
      //   messageRange: 2,
      //   scope: "resource",
      // },

      // 3️⃣ WORKING MEMORY: Desabilitado - causava loops de updateWorkingMemory
      // O perfil do usuário já é injetado via user-profile-loader como contexto fixo
      workingMemory: {
        enabled: false,
      },
    },

    // 4️⃣ GERAÇÃO AUTOMÁTICA DE TÍTULO - Removido temporariamente (API mudou no Mastra 1.3.0)
    // generateTitle: {
    //   model: "github-models/openai/gpt-4o-mini",
    //   instructions: "Gere um título curto (máximo 6 palavras) que resuma o tema principal desta conversa sobre nutrição",
    // },
  });
}

/**
 * Interface do perfil oficial do usuário (vem do banco)
 */
export interface UserProfile {
  id: string;
  name: string;
  age?: number;
  weight?: number;
  height?: number;
  gender?: string;
  allergies: string[];
  restrictions: string[];
  dislikes: string[];
  goal: "weight_loss" | "weight_gain" | "maintain";
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  daily_calories_target?: number;
  daily_protein_target?: number;
  daily_carbs_target?: number;
  daily_fat_target?: number;
}

/**
 * Converte user_profile em mensagem de contexto para o agente
 * Isso injeta os dados oficiais do banco como contexto fixo
 */
export function userProfileToContext(profile: UserProfile) {
  const allergiesText = profile.allergies.length > 0
    ? profile.allergies.join(", ")
    : "Nenhuma alergia registrada";

  const restrictionsText = profile.restrictions.length > 0
    ? profile.restrictions.join(", ")
    : "Nenhuma restrição alimentar";

  const dislikesText = profile.dislikes.length > 0
    ? profile.dislikes.join(", ")
    : "Nenhum alimento especificado";

  const goalText = {
    weight_loss: "Perda de peso",
    weight_gain: "Ganho de peso",
    maintain: "Manutenção de peso",
  }[profile.goal];

  const activityText = {
    sedentary: "Sedentário",
    light: "Levemente ativo",
    moderate: "Moderadamente ativo",
    active: "Ativo",
    very_active: "Muito ativo",
  }[profile.activity_level];

  return {
    role: "system" as const,
    content: `📋 PERFIL OFICIAL DO USUÁRIO (fonte: banco de dados)

👤 Informações Pessoais:
- Nome: ${profile.name}
${profile.age ? `- Idade: ${profile.age} anos` : ""}
${profile.weight ? `- Peso: ${profile.weight} kg` : ""}
${profile.height ? `- Altura: ${profile.height} cm` : ""}
${profile.gender ? `- Sexo: ${profile.gender}` : ""}

🎯 Objetivos:
- Objetivo Principal: ${goalText}
- Nível de Atividade: ${activityText}
${profile.daily_calories_target ? `- Meta Calórica Diária: ${profile.daily_calories_target} kcal` : ""}
${profile.daily_protein_target ? `- Meta de Proteína: ${profile.daily_protein_target}g` : ""}
${profile.daily_carbs_target ? `- Meta de Carboidratos: ${profile.daily_carbs_target}g` : ""}
${profile.daily_fat_target ? `- Meta de Gordura: ${profile.daily_fat_target}g` : ""}

⚠️ Restrições e Alergias:
- Alergias: ${allergiesText}
- Restrições Alimentares: ${restrictionsText}
- Alimentos que não gosta: ${dislikesText}

IMPORTANTE: Estas informações são oficiais e validadas. Sempre respeite alergias e restrições!
`,
  };
}
