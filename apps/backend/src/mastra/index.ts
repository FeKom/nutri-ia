import { Mastra } from "@mastra/core/mastra";
import { registerApiRoute } from "@mastra/core/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { PinoLogger } from "@mastra/loggers";
import { nutritionAnalystAgent } from "./agents/nutrition-analyst";
import { createMealPlanWorkflow } from "./workflows/create-meal-plan";
import { logImageMealWorkflow } from "./workflows/log-image-meal";
import { weeklyProgressReportWorkflow } from "./workflows/weekly-progress-report";
import { createEvalAgent } from "./agents/eval-agent";
import { verifyJwt, extractBearerToken } from "../lib/jwt-auth";
import { checkRateLimit } from "../lib/rate-limiter";
import { asyncContext } from "../lib/async-context";
import { getUserProfileFromDB } from "./utils/user-profile-loader";
import { userProfileToContext } from "../mastra/config/memory";
import { USER_PROFILE_KEY } from "./config/guardrails";
import { RequestContext } from "@mastra/core/request-context";
import { getDailySummary } from "./clients/catalog-client";
import { sharedStorage } from "./config/storage";
import { getObservabilityConfig } from "./config/observabilityOptions";
import { validateEnv, env } from "./config/env";
import { summarizeHistory, injectSummaryAsContext } from "./config/summarizer";

validateEnv();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const logger = new PinoLogger({ name: "NutriAI", level: "info" });

export const mastra = new Mastra({
  storage: sharedStorage,
  workflows: { createMealPlanWorkflow, logImageMealWorkflow, weeklyProgressReportWorkflow },
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
            const userUsername = jwtPayload.username;

            const { messages } = await c.req.json();

            if (!messages || !Array.isArray(messages)) {
              return c.json(
                { error: 'Campo "messages" é obrigatório e deve ser um array' },
                400,
              );
            }

            // Load profile and daily summary in parallel — both are independent
            const today = new Date().toISOString().split("T")[0];
            const [userProfile, dailySummary] = await Promise.all([
              getUserProfileFromDB(userId),
              getDailySummary(userId, today, undefined, token).catch(() => null),
            ]);

            const contextMessages: { role: "system"; content: string }[] = [];

            if (userProfile) {
              contextMessages.push(userProfileToContext(userProfile));
              logger.info({ userId }, "[Chat] user profile loaded");

              if (dailySummary) {
                const { totals, targets, num_meals } = dailySummary;
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
              } else {
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

            logger.info({ userId, userUsername, messageCount: messages.length }, "chat request received");

            // Enforce per-user message rate limit before any expensive work
            const rateLimit = checkRateLimit(userId);
            if (!rateLimit.allowed) {
              c.header("X-RateLimit-Limit", String(process.env.RATE_LIMIT_MAX_REQUESTS ?? 30));
              c.header("X-RateLimit-Remaining", "0");
              c.header("X-RateLimit-Reset", String(Math.ceil(rateLimit.resetAt / 1000)));
              c.header("Retry-After", String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)));
              return c.json({ error: "Rate limit exceeded. Too many messages — try again later." }, 429);
            }

            // jwt_token is propagated via asyncContext so tools can read it.
            // requestContext from c.get() is always undefined on custom registerApiRoute
            // routes — Mastra's middleware never runs for them. We pass resourceId and
            // threadId directly to agent.stream() so memory is routed correctly without
            // depending on the framework's requestContext middleware.
            return asyncContext.run({ userId, jwtToken: token, userProfile }, async () => {
              const mastra = c.get("mastra");
              const nutritionAgent = mastra.getAgent("nutritionAnalystAgent");

              if (!nutritionAgent) {
                return c.json({ error: "Agent não encontrado" }, 500);
              }

              // Summarize older messages when thread grows long to save tokens
              let streamMessages = messages;
              if (messages.length > 8) {
                try {
                  const openai = createOpenAI({
                    apiKey: process.env.GITHUB_TOKEN ?? "",
                    baseURL: "https://models.inference.ai.azure.com",
                  });
                  const modelId = env.MODEL.replace("github-models/", "").replace("openai/", "");
                  const summaryModel = openai.chat(modelId);

                  const { summary, tokensSaved } = await summarizeHistory(messages, summaryModel);
                  if (summary) {
                    const recentMessages = messages.slice(-3);
                    contextMessages.push(injectSummaryAsContext(summary));
                    streamMessages = recentMessages;
                    logger.info({ userId, tokensSaved }, "[Chat] conversation summarized");
                  }
                } catch (err) {
                  logger.warn({ userId, err }, "[Chat] summarization failed, using original messages");
                }
              }

              const requestContext = new RequestContext();
              if (userProfile) {
                requestContext.set(USER_PROFILE_KEY, userProfile);
              }

              const result = await nutritionAgent.stream(streamMessages, {
                context: contextMessages,
                memory: { resource: userId, thread: `chat-${userId}` },
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

              const result = await agent.generate(question, { memoryConfig: { disabled: true }});
              answer = result.text;

              // Extract context from tool call results so metrics are meaningful
              const toolTexts: string[] = [];
              const allToolResults = (result as any).toolResults ?? result.steps?.flatMap((s: any) => s.toolResults ?? []) ?? [];
              for (const toolResult of allToolResults) {
                const content = toolResult.result;
                if (content && typeof content === "object") {
                  const text = JSON.stringify(content);
                  if (text.length > 10) toolTexts.push(text);
                } else if (typeof content === "string" && content.length > 10) {
                  toolTexts.push(content);
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

            // Score via catalog
            const scoreRes = await fetch(`${env.CATALOG_API_URL}/api/v1/eval/score`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question,
                answer,
                context_chunks: contextTexts,
                expected_answer: expected_answer ?? null,
              }),
            });
            const scores = scoreRes.ok ? await scoreRes.json() : null;

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
