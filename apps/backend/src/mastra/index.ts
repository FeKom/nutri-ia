import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import {
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/request-context";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { PinoLogger } from "@mastra/loggers";
import { nutritionAnalystAgent } from "./agents/nutrition-analyst";
import { createEvalAgent } from "./agents/eval-agent";
import { verifyJwt, extractBearerToken } from "../lib/jwt-auth";
import { asyncContext } from "../lib/async-context";
import { getUserProfileFromDB } from "./utils/user-profile-loader";
import { userProfileToContext } from "../mastra/config/memory";
import { getDailySummary } from "./clients/catalog-client";
import { sharedStorage } from "./config/storage";
import { getObservabilityConfig } from "./config/observabilityOptions";
import { validateEnv, env } from "./config/env";
import { auth } from "../lib/auth";
import { scoreAll } from "./eval/scorers";

validateEnv();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const logger = new PinoLogger({ name: "NutriAI", level: "info" });

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
              logger.error({ err }, "JWT verification failed");
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
              logger.info({ userId }, "[Chat] user profile loaded");

              // Injeta progresso do dia para que o agente dê conselhos contextualizados
              try {
                const today = new Date().toISOString().split("T")[0];
                const daily = await getDailySummary(userId, today, undefined, token);
                const { totals, targets, num_meals } = daily;
                const calPct = targets.calories > 0
                  ? Math.round((totals.calories / targets.calories) * 100)
                  : 0;
                contextMessages.push({
                  role: "system" as const,
                  content:
                    `PROGRESSO DE HOJE (${today}): ` +
                    `${Math.round(totals.calories)}/${Math.round(targets.calories)} kcal (${calPct}%) · ` +
                    `Proteína ${Math.round(totals.protein_g)}g/${Math.round(targets.protein_g)}g · ` +
                    `Carbos ${Math.round(totals.carbs_g)}g/${Math.round(targets.carbs_g)}g · ` +
                    `Gordura ${Math.round(totals.fat_g)}g/${Math.round(targets.fat_g)}g · ` +
                    `${num_meals} refeição(ões) registrada(s).`,
                });
                logger.info({ userId, num_meals, calPct }, "[Chat] daily progress injected");
              } catch {
                // Catalog pode estar indisponível ou usuário sem registros — não bloqueia o chat
                logger.warn({ userId }, "[Chat] could not fetch daily progress, skipping");
              }
            } else {
              logger.warn({ userId }, "[Chat] user has no profile — continuing without personalisation");
              contextMessages.push({
                role: "system" as const,
                content:
                  "SISTEMA: O usuário está autenticado (logado) mas ainda não tem um perfil nutricional cadastrado. Oriente o usuário a criar seu perfil acessando a página /onboarding no menu de navegação. NÃO diga que o usuário não está autenticado — ele ESTÁ logado.",
              });
            }

            logger.info({ userId, userEmail, messageCount: messages.length }, "chat request received");

            // Configura contexto do request para que tools possam acessar userId e JWT
            const requestContext = c.get("requestContext");
            requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
            requestContext.set(MASTRA_THREAD_ID_KEY, `chat-${userId}`);
            requestContext.set("jwt_token", token);

            // Mastra v1.4.0 does not reliably forward requestContext into tool
            // execute() calls. AsyncLocalStorage is the guaranteed propagation path.
            // Both are set so that utils/auth-context.ts#extractAuthContext can
            // read from whichever is available. Do not remove either until the
            // framework bug is resolved upstream.
            return asyncContext.run({ userId, jwtToken: token }, async () => {
              const mastra = c.get("mastra");
              const nutritionAgent = mastra.getAgent("nutritionAnalystAgent");

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
            });
          } catch (error) {
            logger.error({ error }, "error in /chat endpoint");
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
      registerApiRoute("/eval/run", {
        method: "POST",
        handler: async (c) => {
          try {
            const body = await c.req.json();
            const { prompt, question, retrieval_source, expected_answer, agent_mode = "direct" } = body;

            if (!question || !retrieval_source) {
              return c.json(
                { error: "question and retrieval_source are required" },
                400,
              );
            }

            const start = Date.now();
            let answer: string;
            let contextChunks: Array<{ content: string; source_name: string }> = [];
            let contextTexts: string[] = [];

            if (agent_mode === "production" || agent_mode === "test") {
              // Run via the real agent (with tools, no memory)
              const agent =
                agent_mode === "production"
                  ? nutritionAnalystAgent
                  : createEvalAgent(prompt ?? "");

              const result = await agent.generate(question, { memoryConfig: { disabled: true } });
              answer = result.text;

              // Extract context from tool call results so metrics are meaningful
              const toolTexts: string[] = [];
              for (const step of result.steps ?? []) {
                for (const toolResult of step.toolResults ?? []) {
                  const content = toolResult.result;
                  if (content && typeof content === "object") {
                    const text = JSON.stringify(content);
                    if (text.length > 10) toolTexts.push(text);
                  } else if (typeof content === "string" && content.length > 10) {
                    toolTexts.push(content);
                  }
                }
              }
              contextTexts = toolTexts;
              contextChunks = toolTexts.map((t) => ({ content: t, source_name: "tool_result" }));
            } else {
              // "direct" — manual RAG + generateText, no tools
              const chunksRes = await fetch(
                `${env.CATALOG_API_URL}/api/v1/eval/chunks/search`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: question, retrieval_source, limit: 5 }),
                },
              );

              const chunksData = chunksRes.ok ? await chunksRes.json() : { chunks: [] };
              contextChunks = chunksData.chunks ?? [];
              contextTexts = contextChunks.map((ch: any) => ch.content);
              const context = contextTexts.join("\n\n");

              const openai = createOpenAI({
                apiKey: process.env.GITHUB_TOKEN ?? "",
                baseURL: "https://models.inference.ai.azure.com",
              });
              const modelId = env.MODEL.replace("github-models/", "").replace("openai/", "");

              const { text } = await generateText({
                model: openai.chat(modelId),
                system: prompt ?? "",
                messages: [
                  {
                    role: "user",
                    content: context ? `Contexto:\n${context}\n\nPergunta: ${question}` : question,
                  },
                ],
              });
              answer = text;
            }

            const latency_ms = Date.now() - start;

            // Score via embedding similarity
            const scores = await scoreAll(
              question,
              answer,
              contextTexts,
              env.CATALOG_API_URL,
              expected_answer ?? undefined,
            );

            return c.json({
              answer,
              context_used: contextChunks,
              latency_ms,
              scores,
            });
          } catch (error) {
            logger.error({ error }, "error in /eval/run endpoint");
            return c.json(
              {
                error: "Failed to run eval",
                details:
                  error instanceof Error ? error.message : "Unknown error",
              },
              500,
            );
          }
        },
      }),
    ],
  },
});
