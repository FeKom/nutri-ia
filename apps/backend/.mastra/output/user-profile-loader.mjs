const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";
const CATALOG_API_TIMEOUT = parseInt(process.env.CATALOG_API_TIMEOUT || "5000");
const PROFILE_CACHE_TTL = 5 * 60 * 1e3;
const profileCache = /* @__PURE__ */ new Map();
function cleanExpiredCache() {
  const now = Date.now();
  for (const [userId, entry] of profileCache.entries()) {
    if (now - entry.timestamp > PROFILE_CACHE_TTL) {
      profileCache.delete(userId);
    }
  }
}
function invalidateUserProfileCache(userId) {
  profileCache.delete(userId);
  console.log(`\u{1F5D1}\uFE0F [Cache] Perfil invalidado para usu\xE1rio: ${userId}`);
}
async function getUserProfileFromDB(userId, forceRefresh = false) {
  if (!userId || userId === "anonymous") {
    console.warn("\u26A0\uFE0F [getUserProfileFromDB] Tentativa de buscar perfil sem user_id v\xE1lido");
    return null;
  }
  cleanExpiredCache();
  if (!forceRefresh) {
    const cached = profileCache.get(userId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < PROFILE_CACHE_TTL) {
        console.log(`\u{1F4E6} [Cache HIT] Perfil do usu\xE1rio ${userId} (idade: ${Math.round(age / 1e3)}s)`);
        return cached.profile;
      }
    }
  }
  try {
    console.log(`\u{1F50D} [API] Buscando perfil para usu\xE1rio: ${userId}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CATALOG_API_TIMEOUT);
    const response = await fetch(`${CATALOG_API_URL}/api/v1/users/profiles/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`\u2139\uFE0F [API] Perfil n\xE3o encontrado para usu\xE1rio ${userId}`);
        profileCache.set(userId, { profile: null, timestamp: Date.now() });
        return null;
      }
      const errorText = await response.text();
      console.error(`\u274C [API] Erro (${response.status}):`, errorText);
      return null;
    }
    const data = await response.json();
    console.log(`\u2705 [API] Perfil carregado com sucesso para ${data.name}`);
    const profile = {
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
      daily_fat_target: data.daily_fat_target
    };
    profileCache.set(userId, { profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`\u23F1\uFE0F [API] Timeout ao buscar perfil do usu\xE1rio ${userId}`);
    } else {
      console.error(`\u274C [API] Erro ao buscar perfil:`, error);
    }
    return null;
  }
}

export { getUserProfileFromDB as g, invalidateUserProfileCache as i };
