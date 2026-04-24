import { NextResponse } from "next/server";
import { z } from "zod";
import { BACKEND_URL } from "@/lib/config";

const FeedbackSchema = z.object({
  messageId: z.string().min(1),
  rating: z.enum(["up", "down"]),
});

export async function POST(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await req.json();
  const parsed = FeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${BACKEND_URL}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(parsed.data),
    });

    if (!response.ok) {
      // Backend endpoint is not yet implemented — fail silently so the UI is unaffected.
      // TODO: remove this fallback once the feedback agent is wired up on the backend.
      console.warn("[feedback] backend returned", response.status, "— storing feedback failed");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Backend unreachable — non-critical, don't surface to user
    return NextResponse.json({ ok: true });
  }
}
