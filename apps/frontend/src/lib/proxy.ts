import { NextRequest } from "next/server";

export const proxy = async (
  request: NextRequest,
  path: string,
  maxRetries: number,
): proxyResponse<T, E> => {};
