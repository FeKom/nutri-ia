import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/request-context";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { PinoLogger } from "@mastra/loggers";
import { nutritionAnalystAgent } from "./agents/nutrition-analyst";
import { verifyJwt, extractBearerToken } from "../lib/jwt-auth";
import { asyncContext } from "../lib/async-context";
import { getUserProfileFromDB } from "./utils/user-profile-loader";
import { userProfileToContext } from "../mastra/config/memory";
import { sharedStorage } from "./config/storage";
import { getObservabilityConfig } from "./config/observabilityOptions";
import { validateEnv } from "./config/env";
import { auth } from "../lib/auth";

validateEnv();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export const mastra = new Mastra({
  storage: sharedStorage,
  workflows: {},
  agents: {
    nutritionAnalystAgent,
  },
  logger: new PinoLogger({
    name: "NutriAI",
    level: "info",
  }),
  observability: getObservabilityConfig(),
  server: {
    cors: {
      origin: [FRONTEND_URL],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "x-mastra-client-type"],
    },
    apiRoutes: [
      registerApiRoute("/auth/*", {
        method: "ALL",
        handler: async (c) => auth.handler(c.req.raw),
      }),
      registerApiRoute("/chat", {
        method: "POST",
        handler: async (c) => {
          try {
            // Valida JWT do header Authorization
            const token = extractBearerToken(c.req.header("Authorization"));
            if (!token) {
              return c.json(
                {
                  error: "Authorization header com Bearer token é obrigatório",
                },
                401,
              );
            }

            let jwtPayload;
            try {
              jwtPayload = await verifyJwt(token);
            } catch (err) {
              console.error("❌ JWT verification failed:", err);
              return c.json({ error: "Token inválido ou expirado" }, 401);
            }

            const userId = jwtPayload.sub;
            const userEmail = jwtPayload.email;

            const { messages } = await c.req.json();

            if (!messages || !Array.isArray(messages)) {
              return c.json(
                { error: 'Campo "messages" é obrigatório e deve ser um array' },
                400,
              );
            }

            // Tenta carregar perfil do usuário
            const userProfile = await getUserProfileFromDB(userId);
            const contextMessages = [];

            if (userProfile) {
              contextMessages.push(userProfileToContext(userProfile));
              console.log(`✅ [Chat] Usuário ${userId} com perfil carregado`);
            } else {
              console.log(
                `⚠️ [Chat] Usuário ${userId} sem perfil - continuando sem personalização`,
              );
              contextMessages.push({
                role: "system" as const,
                content:
                  "SISTEMA: O usuário está autenticado (logado) mas ainda não tem um perfil nutricional cadastrado. Sugira criar um perfil usando a tool create_user_profile. NÃO diga que o usuário não está autenticado — ele ESTÁ logado.",
              });
            }

            console.log(
              "📥 Mastra received:",
              JSON.stringify(
                {
                  userId,
                  userEmail,
                  messageCount: messages.length,
                },
                null,
                2,
              ),
            );

            // Configura contexto do request para que tools possam acessar userId e JWT
            const requestContext = c.get("requestContext");
            requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
            requestContext.set(MASTRA_THREAD_ID_KEY, `chat-${userId}`);
            requestContext.set("jwt_token", token);

            // AsyncLocalStorage garante que userId/JWT propagam para as tools
            // mesmo quando o requestContext do Mastra não é repassado internamente
            return asyncContext.run(
              { userId, jwtToken: token },
              async () => {
                const mastra = c.get("mastra");
                const nutritionAgent =
                  mastra.getAgent("nutritionAnalystAgent");

                if (!nutritionAgent) {
                  return c.json({ error: "Agent não encontrado" }, 500);
                }

                const result = await nutritionAgent.stream(messages, {
                  context: contextMessages,
                  requestContext,
                });

                const uiMessageStream = createUIMessageStream({
                  originalMessages: messages,
                  execute: async ({ writer }) => {
                    for await (const part of toAISdkStream(result, {
                      from: "agent",
                    })) {
                      await writer.write(part);
                    }
                  },
                });

                return createUIMessageStreamResponse({
                  stream: uiMessageStream,
                });
              },
            );
          } catch (error) {
            console.error("❌ Erro no endpoint /chat:", error);
            return c.json(
              {
                error: "Erro ao processar a requisição",
                details:
                  error instanceof Error ? error.message : "Erro desconhecido",
              },
              500,
            );
          }
        },
      }),
    ],
  },
});
