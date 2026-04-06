"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "nutria_token";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  planType: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  session: { user: SessionUser } | null;
  updateToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  isLoading: true,
  session: null,
  updateToken: () => {},
});

function decodeToken(token: string): SessionUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.sub) return null;
    const expMs = payload.exp * 1000;
    if (expMs < Date.now()) return null;
    return {
      id: payload.sub,
      username: payload.username || "",
      name: payload.name || "",
      planType: "free",
      avatarUrl: null,
    };
  } catch {
    return null;
  }
}

export function JwtProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateToken = (newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(STORAGE_KEY, newToken);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setToken(newToken);
  };

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && decodeToken(stored)) {
      setToken(stored);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setToken(e.newValue);
      }
    };
    const onSetToken = (e: Event) => {
      const newToken = (e as CustomEvent<string | null>).detail;
      if (newToken) {
        localStorage.setItem(STORAGE_KEY, newToken);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setToken(newToken);
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("nutria-set-token", onSetToken);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("nutria-set-token", onSetToken);
    };
  }, []);

  const user = token ? decodeToken(token) : null;
  const session = user ? { user } : null;

  return (
    <AuthContext.Provider value={{ token, isLoading, session, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

export function useJwt() {
  const { token, isLoading } = useContext(AuthContext);
  return { token, isLoading };
}
