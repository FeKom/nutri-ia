import { NextRequest, NextResponse } from "next/server";
import { CATALOG_URL } from "@/lib/config";

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${CATALOG_URL}/api/v1/users/profiles/me`, {
    headers: { Authorization: token },
  });
  if (res.status === 404) return NextResponse.json(null, { status: 404 });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Try POST first; if profile already exists (400), fall back to PUT
  const postRes = await fetch(`${CATALOG_URL}/api/v1/users/profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });

  if (postRes.status !== 400) {
    const data = await postRes.json();
    return NextResponse.json(data, { status: postRes.status });
  }

  const putRes = await fetch(`${CATALOG_URL}/api/v1/users/profiles/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  const data = await putRes.json();
  return NextResponse.json(data, { status: putRes.status });
}
