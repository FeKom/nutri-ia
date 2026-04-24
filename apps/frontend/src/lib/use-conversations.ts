'use client';

import { useCallback, useEffect, useState } from 'react';

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
};

const STORAGE_KEY = 'nutria_conversations';

function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(conversations: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Load from localStorage after mount (client-only)
  useEffect(() => {
    setConversations(loadFromStorage());
  }, []);

  const upsert = useCallback((id: string, title: string) => {
    setConversations((prev) => {
      const exists = prev.find((c) => c.id === id);
      const next = exists
        ? prev.map((c) => (c.id === id ? { ...c, title } : c))
        : [{ id, title, createdAt: Date.now() }, ...prev];
      saveToStorage(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  return { conversations, upsert, remove };
}
