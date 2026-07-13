"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNewConversation?: () => void;
  rightAction?: React.ReactNode;
}

export function Header({
  title = "Assistente de Nutricao",
  subtitle,
  onNewConversation,
  rightAction,
}: HeaderProps) {
  return (
    <header className="h-80px border-b border-gray-200 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        <h1 className="heading-serif text-lg text-slate-800">{title}</h1>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onNewConversation && (
          <Button
            onClick={onNewConversation}
            variant="outline"
            size="sm"
            className="border-green-200 text-slate-700 hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova conversa
          </Button>
        )}
        {rightAction}
      </div>
    </header>
  );
}
