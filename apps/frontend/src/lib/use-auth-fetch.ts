"use client";

import { useCallback } from "react";
import { useAuthContext } from "./jwt-context";

export function useAuthFetch() {
  const { token, updateToken } = useAuthContext();

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const response = await fetch(input, { ...init, headers });
      if (response.status === 401) {
        updateToken(null);
        window.location.href = "/login?reason=session_expired";
        return response;
      }
      return response;
    },
    [token, updateToken],
  );

  return authFetch;
}
