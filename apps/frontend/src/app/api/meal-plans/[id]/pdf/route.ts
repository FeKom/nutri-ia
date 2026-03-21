import { NextRequest, NextResponse } from "next/server";

const CATALOG_API_URL = process.env.CATALOG_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = request.headers.get("Authorization");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const response = await fetch(
      `${CATALOG_API_URL}/api/v1/meal-plans/${id}/pdf`,
      {
        method: "GET",
        headers: {
          Authorization: token,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": response.headers.get("Content-Disposition") ||
          'attachment; filename="plano-alimentar.pdf"',
      },
    });
  } catch (error) {
    console.error("Error exporting meal plan PDF:", error);
    return NextResponse.json(
      { error: "Failed to export meal plan PDF" },
      { status: 500 },
    );
  }
}
