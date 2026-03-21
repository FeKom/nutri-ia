"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSession } from "./auth-client";

interface JwtContextValue {
  token: string | null;
  isLoading: boolean;
}

const JwtContext = createContext<JwtContextValue>({
  token: null,
  isLoading: true,
});

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4111";
const REFRESH_INTERVAL = 12 * 60 * 1000; // 12 min (JWT expires in 15m)

export function JwtProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchToken = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/token`, {
        credentials: "include",
      });
      if (!response.ok) {
        setToken(null);
        return;
      }
      const data = await response.json();
      setToken(data.token || null);
    } catch {
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setToken(null);
      setIsLoading(false);
      return;
    }

    fetchToken();
    const interval = setInterval(fetchToken, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [session, fetchToken]);

  return (
    <JwtContext.Provider value={{ token, isLoading }}>
      {children}
    </JwtContext.Provider>
  );
}

export function useJwt() {
  return useContext(JwtContext);
}
