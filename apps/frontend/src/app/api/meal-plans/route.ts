import { NextRequest, NextResponse } from "next/server";

const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") || "1";
  const pageSize = searchParams.get("page_size") || "10";

  try {
    const response = await fetch(
      `${CATALOG_API_URL}/api/v1/meal-plans?page=${page}&page_size=${pageSize}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching meal plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch meal plans" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${CATALOG_API_URL}/api/v1/meal-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating meal plan:", error);
    return NextResponse.json(
      { error: "Failed to create meal plan" },
      { status: 500 },
    );
  }
}
