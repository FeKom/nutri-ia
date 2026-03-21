'use client';

import '@/app/globals.css';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DefaultChatTransport, ToolUIPart, FileUIPart } from 'ai';
import { useChat } from '@ai-sdk/react';
import { Paperclip, Camera, ArrowUp, Leaf, Sparkles, BookOpen, Target } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useJwt } from '@/lib/jwt-context';

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

import { Message, MessageContent, MessageResponse, MessageAttachment, MessageAttachments } from '@/components/ai-elements/message';

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';

import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const suggestionCards = [
  {
    icon: Sparkles,
    title: 'Receitas saudaveis',
    description: 'Encontre receitas nutritivas e deliciosas para seu dia a dia',
    color: 'from-nutria-verde/10 to-nutria-verde/5',
    iconColor: 'text-nutria-verde',
  },
  {
    icon: BookOpen,
    title: 'Analise nutricional',
    description: 'Descubra informacoes nutricionais dos seus alimentos',
    color: 'from-nutria-laranja/10 to-nutria-laranja/5',
    iconColor: 'text-nutria-laranja',
  },
  {
    icon: Target,
    title: 'Planeje suas metas',
    description: 'Crie um plano alimentar personalizado para seus objetivos',
    color: 'from-nutria-bordo/10 to-nutria-bordo/5',
    iconColor: 'text-nutria-bordo',
  },
];

function Chat() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { token } = useJwt();
  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<FileUIPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [redirectAttempts, setRedirectAttempts] = useState(0);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      headers: () => {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      },
    }),
  });

  useEffect(() => {
    if (!isPending && !session && redirectAttempts === 0) {
      setRedirectAttempts(1);
      setTimeout(() => {
        router.push('/login');
      }, 100);
    }
  }, [session, isPending, router, redirectAttempts]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            type: 'file',
            url: dataUrl,
            mediaType: file.type,
            filename: file.name,
          },
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
    window.location.reload();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-nutria-verde flex items-center justify-center animate-pulse-soft">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Verificando autenticacao...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <p className="text-sm text-nutria-bordo/50 animate-fade-in">Redirecionando...</p>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header onNewConversation={handleNewConversation} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {!hasMessages ? (
            /* Tela de boas-vindas */
            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full">
              <div className="mb-14 text-center animate-slide-up">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-nutria-verde to-nutria-verde-light flex items-center justify-center mx-auto mb-6 shadow-lg shadow-nutria-verde/20">
                  <Leaf className="w-10 h-10 text-white" />
                </div>
                <h1 className="heading-serif text-3xl text-nutria-bordo mb-3">
                  Como posso ajudar hoje?
                </h1>
                <p className="text-nutria-bordo/50 max-w-lg mx-auto leading-relaxed">
                  Sou seu assistente de nutricao. Pergunte sobre receitas,
                  planejamento alimentar ou envie uma foto para analise.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                {suggestionCards.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(card.description)}
                      className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border border-white/60 text-left transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 animate-slide-up opacity-0 stagger-${index + 1}`}
                    >
                      <Icon className={`w-5 h-5 ${card.iconColor} mb-3`} />
                      <h3 className="font-semibold text-nutria-bordo text-sm mb-1.5">
                        {card.title}
                      </h3>
                      <p className="text-xs text-nutria-bordo/50 leading-relaxed">
                        {card.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Area de conversa */
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-3xl mx-auto">
                <Conversation className="h-full">
                  <ConversationContent>
                    {messages.map((message) => (
                      <div key={message.id}>
                        {message.parts?.map((part, i) => {
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
                            return (
                              <Message key={`${message.id}-${i}`} from={message.role}>
                                <MessageContent>
                                  <MessageResponse>{part.text}</MessageResponse>
                                </MessageContent>
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
                    ))}
                    <ConversationScrollButton />
                  </ConversationContent>
                </Conversation>
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="p-4 pb-6 bg-gradient-to-t from-nutria-creme via-nutria-creme to-transparent">
            <div className="max-w-3xl mx-auto">
              {/* Attachment buttons */}
              <div className="flex gap-2 mb-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === 'streaming'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-nutria-bordo/50 hover:text-nutria-bordo hover:bg-white/60 transition-all duration-200 disabled:opacity-40"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={status === 'streaming'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-nutria-bordo/50 hover:text-nutria-bordo hover:bg-white/60 transition-all duration-200 disabled:opacity-40"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Foto
                </button>
              </div>

              {/* Message input */}
              <div className="relative">
                <PromptInput
                  onSubmit={handleSubmit}
                  className="border border-nutria-creme-dark rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow duration-300"
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
                      disabled={status === 'streaming'}
                    />
                    <Button
                      type="submit"
                      disabled={status === 'streaming' || (!input.trim() && attachments.length === 0)}
                      size="icon"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-lg transition-all duration-200 shadow-sm disabled:opacity-30"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                  </PromptInputBody>
                </PromptInput>
              </div>

              <p className="text-[11px] text-nutria-bordo/30 text-center mt-3">
                Envie fotos de alimentos para analise nutricional automatica
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Chat;
