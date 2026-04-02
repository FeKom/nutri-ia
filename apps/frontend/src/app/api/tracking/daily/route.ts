import { NextRequest, NextResponse } from "next/server";
import { CATALOG_URL } from "@/lib/config";

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const targetDate = searchParams.get("target_date") ?? "";

  try {
    const url = new URL(`${CATALOG_URL}/api/v1/tracking/summary/daily`);
    if (targetDate) url.searchParams.set("target_date", targetDate);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching daily summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily summary" },
      { status: 500 },
    );
  }
}
