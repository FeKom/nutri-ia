import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";

const MASTRA_API_URL = BACKEND_URL;

function parseAISDKToMastra(params: any) {
  const messages =
    params.messages?.map((msg: any) => ({
      role: msg.role,
      content:
        msg.parts?.map((part: any) => {
          if (part.type === "file") {
            return {
              type: part.type,
              data: part.url,
              mediaType: part.mediaType,
            };
          }
          return {
            type: part.type,
            text: part.text,
          };
        }) || [],
    })) || [];

  return {
    id: params.id || crypto.randomUUID(),
    messages,
    trigger: params.trigger || "submit-message",
  };
}

export async function POST(req: Request) {
  const params = await req.json();

  try {
    const token = req.headers.get("Authorization");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mastraPayload = parseAISDKToMastra(params);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      accept: "text/event-stream",
      Authorization: token,
    };

    const response = await fetch(`${MASTRA_API_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(mastraPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mastra API error:", response.status, errorText);
      throw new Error(`Mastra API error: ${response.status}`);
    }

    req.signal.addEventListener("abort", () => {
      console.log("## Client aborted the request ##");
    });

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error calling Mastra API:", error);
    return NextResponse.json(
      { error: "Failed to communicate with Mastra API" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract userId from JWT payload (base64 decode the payload part)
    const jwtPayload = JSON.parse(
      Buffer.from(token.replace("Bearer ", "").split(".")[1], "base64url").toString(),
    );
    const userId = jwtPayload.sub;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: token,
    };

    const response = await fetch(
      `${MASTRA_API_URL}/agents/nutri-ia/memory?threadId=chat-${userId}&resourceId=${userId}`,
      { method: "GET", headers },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json([]);
      }
      throw new Error(`Mastra API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data.messages || []);
  } catch (error) {
    console.error("Error fetching messages from Mastra API:", error);
    return NextResponse.json([]);
  }
}
