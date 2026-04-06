"use client";

import { useAuthContext } from "./jwt-context";

const CATALOG_URL =
  process.env.NEXT_PUBLIC_CATALOG_URL || "http://localhost:8000";

// --- useSession hook ---

export function useSession() {
  const { session, isLoading } = useAuthContext();
  return { data: session, isPending: isLoading };
}

// --- signIn ---

export const signIn = {
  async email({ username, password }: { username: string; password: string }) {
    try {
      const res = await fetch(`${CATALOG_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: { message: data.detail || "Invalid credentials" } };
      }
      window.dispatchEvent(new CustomEvent("nutria-set-token", { detail: data.token }));
      return { error: null };
    } catch {
      return { error: { message: "Network error. Please try again." } };
    }
  },
};

// --- signUp ---

export const signUp = {
  async email({
    username,
    name,
    password,
  }: {
    username: string;
    name: string;
    password: string;
  }) {
    try {
      const res = await fetch(`${CATALOG_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: { message: data.detail || "Registration failed" } };
      }
      window.dispatchEvent(new CustomEvent("nutria-set-token", { detail: data.token }));
      return { error: null };
    } catch {
      return { error: { message: "Network error. Please try again." } };
    }
  },
};

// --- signOut ---

export async function signOut() {
  window.dispatchEvent(new CustomEvent("nutria-set-token", { detail: null }));
}
