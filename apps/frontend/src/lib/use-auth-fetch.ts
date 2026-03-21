"use client";

import { useCallback } from "react";
import { useJwt } from "./jwt-context";

export function useAuthFetch() {
  const { token } = useJwt();

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return fetch(input, { ...init, headers });
    },
    [token],
  );

  return authFetch;
}
