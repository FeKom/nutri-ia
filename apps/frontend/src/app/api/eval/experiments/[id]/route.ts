const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/experiments/${id}`);
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/experiments/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
