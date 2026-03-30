import { z } from "zod";
import { CATALOG_URL as CATALOG_API_URL } from "@/lib/config";

const EvalExperimentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  prompt: z.string().min(1),
  retrieval_source: z.string().default("json"),
  dataset_filename: z.string().default("golden_dataset.json"),
  agent_mode: z.enum(["direct", "production", "test"]).default("direct"),
});

export async function GET() {
  try {
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/experiments`);
    const data = await response.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = EvalExperimentCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/experiments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
