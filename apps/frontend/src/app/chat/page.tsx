'use client';

import '@/app/globals.css';
import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DefaultChatTransport, ToolUIPart, FileUIPart } from 'ai';
import { useChat } from '@ai-sdk/react';
import {
  Paperclip,
  Camera,
  ArrowUp,
  Square,
  ThumbsUp,
  ThumbsDown,
  Leaf,
  Sparkles,
  BookOpen,
  Target,
  AlertCircle,
  Wrench,
  X,
  CheckCircle,
  Clock,
  Circle,
  XCircle,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useSession } from '@/lib/auth-client';
import { useJwt } from '@/lib/jwt-context';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { useConversations } from '@/lib/use-conversations';

import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';

import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageAttachment,
  MessageAttachments,
} from '@/components/ai-elements/message';

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import Link from 'next/link';

// ─── Suggestion cards ────────────────────────────────────────────────────────

const suggestionCards = [
  {
    icon: Sparkles,
    title: 'Receitas saudaveis',
    description: 'Encontre receitas nutritivas e deliciosas para seu dia a dia',
    color: 'from-green-600/10 to-green-600/5',
    iconColor: 'text-green-600',
  },
  {
    icon: BookOpen,
    title: 'Analise nutricional',
    description: 'Descubra informacoes nutricionais dos seus alimentos',
    color: 'from-orange-500/10 to-orange-500/5',
    iconColor: 'text-orange-600',
  },
  {
    icon: Target,
    title: 'Planeje suas metas',
    description: 'Crie um plano alimentar personalizado para seus objetivos',
    color: 'from-slate-900/10 to-slate-900/5',
    iconColor: 'text-slate-900',
  },
];

// ─── Follow-up suggestion derivation ─────────────────────────────────────────

function deriveFollowUps(lastMessage: string): string[] {
  const t = lastMessage.toLowerCase();
  if (t.includes('receita') || t.includes('preparo') || t.includes('ingrediente')) {
    return ['Me dê outra opção de receita', 'Quais os macros dessa receita?', 'Tem uma versão mais rápida?'];
  }
  if (t.includes('plano alimentar') || t.includes('dieta')) {
    return ['Ver meu plano atual', 'Ajustar calorias do plano', 'Exportar plano em PDF'];
  }
  if (t.includes('caloria') || t.includes('proteína') || t.includes('carboidrato') || t.includes('macro')) {
    return ['Registrar essa refeição', 'Ver meu progresso de hoje', 'Sugerir alimentos mais proteicos'];
  }
  if (t.includes('meta') || t.includes('objetivo') || t.includes('peso')) {
    return ['Atualizar minha meta', 'Ver evolução semanal', 'Como melhorar meus resultados?'];
  }
  if (t.includes('imagem') || t.includes('foto') || t.includes('anali')) {
    return ['Registrar essa refeição', 'Calcular as calorias totais', 'Sugerir alternativa mais saudável'];
  }
  return ['Ver meu progresso semanal', 'Sugerir uma receita saudável', 'Registrar uma refeição'];
}

// ─── Tool sidebar item ────────────────────────────────────────────────────────

function ToolSidebarItem({ part }: { part: ToolUIPart }) {
  const name = part.type.split('-').slice(1).join('-');
  const state = part.state;

  const dot = (() => {
    if (state === 'output-available') return <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    if (state === 'output-error') return <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    if (state === 'input-available') return <Clock className="w-3.5 h-3.5 text-orange-600 animate-pulse shrink-0" />;
    return <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
  })();

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-2">
      <div className="flex items-center gap-2">
        {dot}
        <span className="text-xs text-slate-900 truncate">{name}</span>
      </div>
      {state === 'output-error' && part.errorText && (
        <p className="mt-1 text-[10px] text-red-500 truncate pl-5">{part.errorText}</p>
      )}
    </div>
  );
}

// ─── Main chat component ──────────────────────────────────────────────────────

function ChatContent({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { token } = useJwt();
  const tokenRef = useRef<string | null>(token);
  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [showToolSidebar, setShowToolSidebar] = useState(false);
  const authFetch = useAuthFetch();
  const { upsert } = useConversations();

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const { messages, sendMessage, status, stop } = useChat({
    id: conversationId,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => {
        const headers: Record<string, string> = {};
        if (tokenRef.current) {
          headers['Authorization'] = `Bearer ${tokenRef.current}`;
        }
        return headers;
      },
    }),
  });

  // Collect all tool calls across the conversation for the sidebar
  const toolCalls = useMemo(
    () =>
      messages.flatMap((msg) =>
        (msg.parts ?? [])
          .filter((p) => p.type?.startsWith('tool-'))
          .map((p) => p as ToolUIPart),
      ),
    [messages],
  );

  useEffect(() => {
    if (!isPending && !session && redirectAttempts === 0) {
      setRedirectAttempts(1);
      setTimeout(() => router.push('/login'), 100);
    }
  }, [session, isPending, router, redirectAttempts]);

  useEffect(() => {
    if (!session || !token) return;
    authFetch('/api/profile')
      .then((r) => {
        if (r.status === 404) setHasProfile(false);
        else if (r.ok) setHasProfile(true);
      })
      .catch(() => {});
  }, [session, token, authFetch]);

  const handleFeedback = (messageId: string, rating: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [messageId]: rating }));
    authFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, rating }),
    }).catch(() => {});
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          { type: 'file', url: dataUrl, mediaType: file.type, filename: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!input.trim() && attachments.length === 0) return;

    // Register conversation on first message
    if (messages.length === 0) {
      const title = input.trim().slice(0, 60);
      upsert(conversationId, title);
      // Update URL so a reload returns to this conversation
      window.history.replaceState({}, '', `/chat?conv=${conversationId}`);
    }

    sendMessage({
      text: input || 'Analise esta imagem e identifique os alimentos com suas calorias.',
      files: attachments.map((att) => ({
        type: 'file' as const,
        url: att.url,
        mediaType: att.mediaType,
        filename: att.filename,
      })),
    });
    setInput('');
    setAttachments([]);
  };

  const handleNewConversation = () => {
    router.push(`/chat?conv=${nanoid()}`);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const isGenerating = status === 'submitted' || status === 'streaming';

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-green-600 flex items-center justify-center animate-pulse-soft">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-slate-400">Verificando autenticacao...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-slate-400 animate-fade-in">Redirecionando...</p>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  // Tool sidebar toggle button rendered in the Header's rightAction slot
  const toolToggle = (
    <button
      type="button"
      onClick={() => setShowToolSidebar((v) => !v)}
      title={showToolSidebar ? 'Fechar ferramentas' : 'Ver ferramentas'}
      className={cn(
        'relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors duration-150',
        showToolSidebar
          ? 'bg-green-50 text-green-600'
          : 'text-slate-400 hover:text-slate-900 hover:bg-gray-100',
      )}
    >
      <Wrench className="w-3.5 h-3.5" />
      Ferramentas
      {toolCalls.length > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-600 text-white text-[9px] flex items-center justify-center font-medium">
          {toolCalls.length}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onNewConversation={handleNewConversation} rightAction={toolToggle} />

        {hasProfile === false && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-sm text-slate-900/80 flex-1">
              Voce ainda nao criou seu perfil nutricional. O assistente funcionara melhor com suas informacoes.
            </p>
            <Link
              href="/onboarding"
              className="text-xs font-medium text-green-600 hover:text-green-600-light whitespace-nowrap"
            >
              Criar perfil →
            </Link>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Chat area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {!hasMessages ? (
              /* Welcome screen */
              <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                <div className="mb-12 text-center animate-slide-up w-full">
                  {/* Icon */}
                  <div className="relative inline-flex mb-7">
                    <div className="w-16 h-16 rounded-2xl gradient-health flex items-center justify-center shadow-lg shadow-green-600/25 animate-glow-pulse">
                      <Leaf className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white animate-pulse" />
                  </div>
                  <h1 className="heading-serif text-4xl text-slate-900 mb-3 leading-tight">
                    Como posso ajudar hoje?
                  </h1>
                  <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                    Pergunte sobre receitas, planejamento alimentar ou envie uma foto para análise.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                  {suggestionCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(card.description)}
                        className={`group p-5 rounded-2xl bg-white border border-gray-100 text-left transition-all duration-200 hover:border-green-200 hover:shadow-md hover:shadow-green-600/5 hover:-translate-y-0.5 active:scale-[0.98] animate-slide-up opacity-0 stagger-${index + 1}`}
                      >
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110`}>
                          <Icon className={`w-4 h-4 ${card.iconColor}`} />
                        </div>
                        <h3 className="font-semibold text-slate-800 text-sm mb-1.5">
                          {card.title}
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {card.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Conversation area */
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-3xl mx-auto">
                  <Conversation className="h-full">
                    <ConversationContent>
                      {messages.map((message) => {
                        const parts = message.parts ?? [];
                        const lastTextIdx = parts.reduce<number>(
                          (acc, p, idx) => (p.type === 'text' ? idx : acc),
                          -1,
                        );
                        const isActivelyGenerating =
                          isGenerating && message.id === messages[messages.length - 1]?.id;

                        return (
                          <div key={message.id}>
                            {parts.map((part, i) => {
                              if (part.type === 'file') {
                                return (
                                  <Message key={`${message.id}-${i}`} from={message.role}>
                                    <MessageAttachments>
                                      <MessageAttachment data={part as FileUIPart} />
                                    </MessageAttachments>
                                  </Message>
                                );
                              }

                              if (part.type === 'text') {
                                const showFeedback =
                                  message.role === 'assistant' &&
                                  i === lastTextIdx &&
                                  !isActivelyGenerating;
                                return (
                                  <Message key={`${message.id}-${i}`} from={message.role}>
                                    <MessageContent>
                                      <MessageResponse>{part.text}</MessageResponse>
                                    </MessageContent>
                                    {showFeedback && (
                                      <MessageActions className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <MessageAction
                                          tooltip="Resposta útil"
                                          onClick={() => handleFeedback(message.id, 'up')}
                                          className={cn(
                                            feedback[message.id] === 'up' && 'text-green-600',
                                          )}
                                        >
                                          <ThumbsUp className="w-3.5 h-3.5" />
                                        </MessageAction>
                                        <MessageAction
                                          tooltip="Resposta não útil"
                                          onClick={() => handleFeedback(message.id, 'down')}
                                          className={cn(
                                            feedback[message.id] === 'down' && 'text-red-600',
                                          )}
                                        >
                                          <ThumbsDown className="w-3.5 h-3.5" />
                                        </MessageAction>
                                      </MessageActions>
                                    )}
                                  </Message>
                                );
                              }

                              if (part.type?.startsWith('tool-')) {
                                return (
                                  <Tool key={`${message.id}-${i}`}>
                                    <ToolHeader
                                      type={(part as ToolUIPart).type}
                                      state={(part as ToolUIPart).state || 'output-available'}
                                      className="cursor-pointer"
                                    />
                                    <ToolContent>
                                      <ToolInput input={(part as ToolUIPart).input || {}} />
                                      <ToolOutput
                                        output={(part as ToolUIPart).output}
                                        errorText={(part as ToolUIPart).errorText}
                                      />
                                    </ToolContent>
                                  </Tool>
                                );
                              }

                              return null;
                            })}
                          </div>
                        );
                      })}

                      {/* Follow-up suggestions */}
                      {(() => {
                        if (status !== 'ready' || messages.length === 0) return null;
                        const lastMsg = messages[messages.length - 1];
                        if (lastMsg.role !== 'assistant') return null;
                        const text = (lastMsg.parts ?? [])
                          .filter((p) => p.type === 'text')
                          .map((p) => (p as { text: string }).text)
                          .join(' ');
                        const suggestions = deriveFollowUps(text);
                        return (
                          <div className="flex flex-wrap gap-2 mt-3 mb-1 pl-1">
                            {suggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleSuggestionClick(s)}
                                className="px-3 py-1.5 text-xs text-slate-900/70 bg-white border border-gray-200 rounded-full hover:bg-gray-100 hover:text-slate-900 transition-colors duration-150"
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Thinking indicator */}
                      {status === 'submitted' && (
                        <div className="flex items-start gap-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center shrink-0 mt-1">
                            <Leaf className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 border border-gray-200 shadow-sm">
                            <div className="flex gap-1.5 items-center h-5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-900/40 animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-900/40 animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-900/40 animate-bounce [animation-delay:300ms]" />
                            </div>
                          </div>
                        </div>
                      )}

                      <ConversationScrollButton />
                    </ConversationContent>
                  </Conversation>
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-4 pb-6 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
              <div className="max-w-3xl mx-auto">
                <div className="flex gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-white/60 transition-[color,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-40"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Arquivo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-900 hover:bg-white/60 transition-[color,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-40"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Foto
                  </button>
                </div>

                <div className="relative">
                  <PromptInput
                    onSubmit={handleSubmit}
                    className={cn(
                      'border border-gray-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-[box-shadow,opacity] duration-300',
                      isGenerating && 'opacity-60',
                    )}
                  >
                    {attachments.length > 0 && (
                      <MessageAttachments className="p-3 pb-0">
                        {attachments.map((file, index) => (
                          <MessageAttachment
                            key={`${file.filename}-${index}`}
                            data={file}
                            onRemove={() => removeAttachment(index)}
                          />
                        ))}
                      </MessageAttachments>
                    )}
                    <PromptInputBody>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <PromptInputTextarea
                        onChange={(e) => setInput(e.target.value)}
                        className="pr-11 max-h-80"
                        value={input}
                        placeholder="Pergunte sobre nutricao, receitas ou alimentacao..."
                      />
                      <Button
                        type={isGenerating ? 'button' : 'submit'}
                        onClick={isGenerating ? stop : undefined}
                        disabled={!isGenerating && !input.trim() && attachments.length === 0}
                        size="icon"
                        className={cn(
                          'absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 text-white rounded-lg transition-[background-color,opacity] duration-150 shadow-sm disabled:opacity-30',
                          isGenerating
                            ? 'bg-slate-900 hover:bg-slate-900/80'
                            : 'bg-green-600 hover:bg-green-600-light',
                        )}
                      >
                        {isGenerating ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : (
                          <ArrowUp className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </PromptInputBody>
                  </PromptInput>
                </div>

                <p className="text-[11px] text-slate-300 text-center mt-3">
                  Envie fotos de alimentos para analise nutricional automatica
                </p>
              </div>
            </div>
          </div>

          {/* Tool sidebar */}
          {showToolSidebar && (
            <aside className="w-64 shrink-0 h-full bg-white border-l border-border flex flex-col">
              <div className="h-[56px] flex items-center justify-between px-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-900">Ferramentas</span>
                  {toolCalls.length > 0 && (
                    <span className="text-xs text-slate-400">({toolCalls.length})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowToolSidebar(false)}
                  className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-900 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {toolCalls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                    <Wrench className="w-6 h-6 text-slate-900/20" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Nenhuma ferramenta<br />utilizada ainda
                    </p>
                  </div>
                ) : (
                  // Reverse so newest is at top
                  [...toolCalls].reverse().map((part, i) => (
                    <ToolSidebarItem key={i} part={part} />
                  ))
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Suspense wrapper (useSearchParams requires it) ───────────────────────────

function ChatWithParams() {
  const searchParams = useSearchParams();
  const convFromUrl = searchParams.get('conv');
  // Stable fallback ID when no conv param — only created once per mount
  const [localConvId] = useState(() => nanoid());
  const conversationId = convFromUrl ?? localConvId;

  // key={conversationId} forces a full remount on conversation switch,
  // cleanly resetting all useChat state
  return <ChatContent key={conversationId} conversationId={conversationId} />;
}

export default function Chat() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <div className="w-14 h-14 rounded-2xl bg-green-600 flex items-center justify-center animate-pulse">
            <Leaf className="w-8 h-8 text-white" />
          </div>
        </div>
      }
    >
      <ChatWithParams />
    </Suspense>
  );
}
