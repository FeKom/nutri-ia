import { CATALOG_URL } from "@/lib/config";

export async function POST(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const response = await fetch(`${CATALOG_URL}/api/v1/eval/datasets/${filename}/ingest`, {
    method: "POST",
  });
  const data = await response.json();
  return Response.json(data, { status: response.status });
}
