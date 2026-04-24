'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  BookOpen,
  Target,
  Activity,
  TrendingUp,
  Settings,
  ClipboardList,
  FlaskConical,
  Leaf,
  UserCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useConversations } from '@/lib/use-conversations';
import { nanoid } from 'nanoid';

const menuItems = [
  { label: 'Chat', icon: MessageSquare, href: '/chat' },
  { label: 'Perfil', icon: UserCircle, href: '/onboarding' },
  { label: 'Dietas', icon: ClipboardList, href: '/dietas' },
  { label: 'Receitas', icon: BookOpen, href: '/receitas' },
  { label: 'Metas', icon: Target, href: '/metas' },
  { label: 'Atividades', icon: Activity, href: '/atividades' },
  { label: 'Progresso', icon: TrendingUp, href: '/progresso' },
  { label: 'Configuracoes', icon: Settings, href: '/configuracoes' },
  { label: 'Eval Lab', icon: FlaskConical, href: '/eval' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { conversations, remove } = useConversations();
  const isChat = pathname === '/chat';

  // Detect active conversation from URL (client-only, best-effort)
  const activeConvId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('conv')
      : null;

  return (
    <aside className="w-[220px] h-screen bg-white border-r border-border flex flex-col animate-slide-in-left">
      {/* Logo */}
      <div className="h-[72px] flex items-center px-5 border-b border-border">
        <Link href="/chat" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-nutria-verde flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="heading-serif text-xl text-nutria-bordo tracking-tight">
            nutri.a
          </span>
        </Link>
      </div>

      {/* User */}
      {session?.user && (
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nutria-verde to-nutria-verde-light flex items-center justify-center shadow-sm">
              {session.user.avatarUrl ? (
                <img
                  src={session.user.avatarUrl}
                  alt={session.user.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-white">
                  {session.user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-nutria-bordo truncate">
                {session.user.name || 'Usuario'}
              </p>
              <p className="text-xs text-nutria-bordo/50 capitalize">
                Plano free
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
                    isActive
                      ? 'bg-nutria-verde/10 text-nutria-bordo font-medium shadow-sm'
                      : 'text-nutria-bordo/60 hover:bg-nutria-creme-dark hover:text-nutria-bordo'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 w-[3px] h-5 bg-nutria-verde rounded-r-full" />
                  )}
                  <Icon className={cn(
                    'w-[18px] h-[18px] shrink-0 transition-colors',
                    isActive ? 'text-nutria-verde' : ''
                  )} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Conversation history — only visible on /chat */}
      {isChat && (
        <div className="border-t border-border flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-[10px] text-nutria-bordo/40 uppercase tracking-wider font-medium">
              Conversas
            </span>
            <button
              type="button"
              onClick={() => router.push(`/chat?conv=${nanoid()}`)}
              title="Nova conversa"
              className="w-5 h-5 flex items-center justify-center rounded text-nutria-bordo/40 hover:text-nutria-verde hover:bg-nutria-verde/10 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="overflow-y-auto max-h-44 px-2 pb-2 space-y-0.5">
            {conversations.length === 0 ? (
              <li className="px-2 py-2 text-[11px] text-nutria-bordo/30 italic">
                Nenhuma conversa ainda
              </li>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <li key={conv.id} className="group/conv flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/chat?conv=${conv.id}`)}
                      className={cn(
                        'flex-1 min-w-0 text-left px-2 py-1.5 rounded-lg text-xs truncate transition-colors duration-150',
                        isActive
                          ? 'bg-nutria-verde/10 text-nutria-bordo font-medium'
                          : 'text-nutria-bordo/60 hover:bg-nutria-creme-dark hover:text-nutria-bordo'
                      )}
                    >
                      {conv.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        remove(conv.id);
                        if (isActive) router.push('/chat');
                      }}
                      title="Excluir conversa"
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover/conv:opacity-100 text-nutria-bordo/30 hover:text-nutria-vermelho transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[10px] text-nutria-bordo/30 tracking-wide uppercase">
          nutri.a v1.0
        </p>
      </div>
    </aside>
  );
}
