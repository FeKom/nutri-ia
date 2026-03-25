const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

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
    const body = await request.json();
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
