'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNewConversation?: () => void;
}

export function Header({
  title = 'Assistente de Nutricao',
  subtitle,
  onNewConversation,
}: HeaderProps) {
  return (
    <header className="h-[72px] border-b border-border bg-white/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div>
        <h1 className="heading-serif text-lg text-nutria-bordo">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-nutria-bordo/50 mt-0.5">{subtitle}</p>
        )}
      </div>

      {onNewConversation && (
        <Button
          onClick={onNewConversation}
          variant="outline"
          size="sm"
          className="border-nutria-verde/30 text-nutria-bordo hover:bg-nutria-verde/5 hover:border-nutria-verde/50 transition-all duration-200"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova conversa
        </Button>
      )}
    </header>
  );
}
