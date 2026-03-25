const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/datasets`);
    const data = await response.json();
    return Response.json(data);
  } catch {
    return Response.json([], { status: 200 });
  }
}
