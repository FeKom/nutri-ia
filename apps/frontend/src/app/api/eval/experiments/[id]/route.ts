import { NextRequest } from "next/server";
import { CATALOG_URL as CATALOG_API_URL } from "@/lib/config";

export async function GET(
  _request: NextRequest,
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const response = await fetch(`${CATALOG_API_URL}/api/v1/eval/experiments/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
    });
    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
