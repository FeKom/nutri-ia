import { NextRequest, NextResponse } from "next/server";
import { CATALOG_URL } from "@/lib/config";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("Authorization");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${CATALOG_URL}/api/v1/activities/${id}`, {
    method: "DELETE",
    headers: { Authorization: token },
  });
  return new NextResponse(null, { status: res.status });
}
