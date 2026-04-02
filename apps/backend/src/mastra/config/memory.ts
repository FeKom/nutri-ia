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
import { PgVector, PostgresStore } from "@mastra/pg";
import { embedderModel } from "./embedder";


export function createNutritionMemory() {
  return new Memory({
    storage: new PostgresStore({
      id: "nutria-agent-storage",
      connectionString: process.env.DATABASE_URl || "postgresql://nutriauser:Ck1VMVI7gxKeO9sYxZRciw73BlHk4sgO32gXHTHEZW8@localhost:5432/nutriadb",
    }),
    vector: new PgVector({
      id: "nutria-agent-vector",
      connectionString: process.env.DATABASE_URL,
    }),
    embedder: embedderModel,
    options: {
      // 1️⃣ MESSAGE HISTORY: Últimas conversas (reduzido para evitar ultrapassar limite de tokens)
      lastMessages: 10,
      semanticRecall: {
        topK: 5,
        messageRange: 3,
        scope: "resource",
        indexConfig: {
          type: "hnsw",
        },
      },

      // 3️⃣ WORKING MEMORY
      // Was disabled because the agent looped calling updateWorkingMemory with no
      // structure — it kept rewriting the same empty state every turn. Root cause:
      // no template meant the agent had nothing concrete to fill in, so it kept
      // trying. Fix: the structured markdown template below gives the agent clear
      // sections to fill, which stops aimless updates. Re-enabled with template.
      workingMemory: {
        enabled: true,
        // Markdown chosen over JSON: the LLM updates this field in natural
        // language — markdown is forgiving on partial writes whereas a missing
        // JSON comma silently corrupts the whole object.
        //
        // Rule: never duplicate what is already in the injected DB profile
        // (name, weight, allergies, goals). Only capture what the agent
        // LEARNS during conversation that isn't persisted anywhere else.
        template: `# Session Context
<!-- What the user is currently working on or discussing -->
- Current focus:
- Last meal plan discussed:
- Pending action (if any):

# Discovered Preferences
<!-- Foods or meals the user mentioned liking or disliking beyond the DB profile -->
- Likes:
- Dislikes:
- Preferred cuisines:
- Preferred meal times:

# Temporary Adjustments
<!-- Short-term context that changes week to week (travel, illness, events) -->
- Active adjustment:
- Valid until:

# Corrections & Clarifications
<!-- If the user corrected the agent or clarified something about their profile -->
- Note:

# Nutrition Insights
<!-- Patterns or observations the agent noticed across multiple messages -->
- Observation:
`,
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
  const allergiesText =
    profile.allergies.length > 0
      ? profile.allergies.join(", ")
      : "Nenhuma alergia registrada";

  const restrictionsText =
    profile.restrictions.length > 0
      ? profile.restrictions.join(", ")
      : "Nenhuma restrição alimentar";

  const dislikesText =
    profile.dislikes.length > 0
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
