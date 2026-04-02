import { NextRequest, NextResponse } from "next/server";
import { CATALOG_URL } from "@/lib/config";

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${CATALOG_URL}/api/v1/activities`, {
    headers: { Authorization: token },
  });
  const data = res.ok ? await res.json() : [];
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const res = await fetch(`${CATALOG_URL}/api/v1/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
