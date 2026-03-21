/**
 * Helper para carregar user_profile do banco e injetar como contexto
 *
 * Este arquivo demonstra como combinar:
 * 1. Dados oficiais do user_profile (banco)
 * 2. Working Memory (aprendizados do agente)
 * 3. Memory (message history + semantic recall)
 */

import { UserProfile, userProfileToContext } from "../config/memory";

const CATALOG_API_URL = process.env.CATALOG_API_URL || 'http://localhost:8000';
const CATALOG_API_TIMEOUT = parseInt(process.env.CATALOG_API_TIMEOUT || '5000');

// Cache de perfis de usuário (TTL de 5 minutos)
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos em ms
const profileCache = new Map<string, { profile: UserProfile | null; timestamp: number }>();

/**
 * Limpa entradas expiradas do cache
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [userId, entry] of profileCache.entries()) {
    if (now - entry.timestamp > PROFILE_CACHE_TTL) {
      profileCache.delete(userId);
    }
  }
}

/**
 * Invalida o cache de um usuário específico
 * Use quando o perfil for atualizado/criado
 */
export function invalidateUserProfileCache(userId: string) {
  profileCache.delete(userId);
  console.log(`🗑️ [Cache] Perfil invalidado para usuário: ${userId}`);
}

/**
 * Busca o perfil do usuário do Catalog API (com cache)
 *
 * @param userId - ID do usuário (geralmente vem do X-User-Id header)
 * @param forceRefresh - Se true, ignora o cache e busca direto da API
 * @returns UserProfile ou null se não encontrado
 */
export async function getUserProfileFromDB(
  userId: string,
  forceRefresh: boolean = false
): Promise<UserProfile | null> {
  if (!userId || userId === 'anonymous') {
    console.warn('⚠️ [getUserProfileFromDB] Tentativa de buscar perfil sem user_id válido');
    return null;
  }

  // Limpa cache expirado periodicamente
  cleanExpiredCache();

  // Verifica se há entrada válida no cache
  if (!forceRefresh) {
    const cached = profileCache.get(userId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < PROFILE_CACHE_TTL) {
        console.log(`📦 [Cache HIT] Perfil do usuário ${userId} (idade: ${Math.round(age / 1000)}s)`);
        return cached.profile;
      }
    }
  }

  try {
    console.log(`🔍 [API] Buscando perfil para usuário: ${userId}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CATALOG_API_TIMEOUT);

    const response = await fetch(`${CATALOG_API_URL}/api/v1/users/profiles/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`ℹ️ [API] Perfil não encontrado para usuário ${userId}`);
        // Cacheia o resultado negativo também (evita chamadas repetidas para usuários sem perfil)
        profileCache.set(userId, { profile: null, timestamp: Date.now() });
        return null;
      }

      const errorText = await response.text();
      console.error(`❌ [API] Erro (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`✅ [API] Perfil carregado com sucesso para ${data.name}`);

    // Mapeia os campos da API do Catalog para a interface UserProfile
    const profile: UserProfile = {
      id: data.user_id,
      name: data.name,
      age: data.age,
      weight: data.weight_kg,
      height: data.height_cm,
      gender: data.gender,
      allergies: data.allergies || [],
      restrictions: data.dietary_restrictions || [],
      dislikes: data.disliked_foods || [],
      goal: data.diet_goal || "maintain",
      activity_level: data.activity_level || "moderate",
      daily_calories_target: data.daily_calories_target,
      daily_protein_target: data.daily_protein_target,
      daily_carbs_target: data.daily_carbs_target,
      daily_fat_target: data.daily_fat_target,
    };

    // Armazena no cache
    profileCache.set(userId, { profile, timestamp: Date.now() });

    return profile;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`⏱️ [API] Timeout ao buscar perfil do usuário ${userId}`);
    } else {
      console.error(`❌ [API] Erro ao buscar perfil:`, error);
    }
    return null;
  }
}

/**
 * Obtém estatísticas do cache para debug
 */
export function getCacheStats() {
  return {
    size: profileCache.size,
    entries: Array.from(profileCache.entries()).map(([userId, entry]) => ({
      userId,
      hasProfile: !!entry.profile,
      age: Math.round((Date.now() - entry.timestamp) / 1000),
    })),
  };
}

/**
 * NOTA: Exemplos de uso removidos.
 *
 * A API do Mastra mudou na versão 1.4.0:
 * - resourceId e threadId não são mais passados diretamente
 * - Use requestContext ao invés disso
 * - Veja src/mastra/index.ts para exemplo atualizado
 */
