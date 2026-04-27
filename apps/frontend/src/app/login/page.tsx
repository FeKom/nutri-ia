'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Leaf, ArrowRight, Zap, Shield, TrendingUp } from 'lucide-react';

const stats = [
  { label: 'Calorias hoje', value: '1.840', unit: 'kcal', icon: Zap, color: 'text-green-300' },
  { label: 'Proteína', value: '94g', unit: '/ 120g', icon: Shield, color: 'text-emerald-300' },
  { label: 'Aderência semanal', value: '87', unit: '%', icon: TrendingUp, color: 'text-teal-300' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get('reason') === 'session_expired';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn.email({ username, password });
      if (result.error) {
        setError(result.error.message || 'Usuário ou senha inválidos.');
        setLoading(false);
        return;
      }
      window.location.href = '/chat';
    } catch (err: any) {
      setError(err.message || 'Usuário ou senha inválidos.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* ── Left panel: Branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[#052e16]">
        {/* Mesh gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-green-700/40 blur-[96px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-emerald-600/30 blur-[80px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-teal-700/20 blur-[64px]" />
        </div>

        {/* Grain texture */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-400/30 backdrop-blur-sm flex items-center justify-center">
              <Leaf className="w-5 h-5 text-green-300" />
            </div>
            <span className="heading-serif text-xl text-white/90 tracking-tight">nutri.a</span>
          </div>

          {/* Hero text */}
          <div className="max-w-[380px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-400/20 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 text-xs font-medium tracking-wide">IA nutricional ativa</span>
            </div>
            <h2 className="heading-serif text-5xl leading-[1.1] mb-5 text-white">
              Sua jornada para uma vida mais saudável.
            </h2>
            <p className="text-white/50 text-base leading-relaxed">
              Planejamento nutricional inteligente, receitas personalizadas e acompanhamento do seu progresso.
            </p>
          </div>

          {/* Floating stat cards */}
          <div className="space-y-3">
            <p className="text-white/30 text-xs uppercase tracking-widest font-medium mb-1">Exemplo de uso</p>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.05] border border-white/10 backdrop-blur-sm animate-slide-up"
                  style={{ animationDelay: `${0.1 + i * 0.08}s` }}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/40 text-xs">{stat.label}</p>
                    <p className="text-white font-semibold text-sm">
                      {stat.value} <span className="text-white/40 font-normal">{stat.unit}</span>
                    </p>
                  </div>
                  <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400/70"
                      style={{ width: i === 0 ? '72%' : i === 1 ? '78%' : '87%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-[380px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="heading-serif text-xl text-slate-900">nutri.a</span>
          </div>

          <div className="mb-8">
            <h1 className="heading-serif text-3xl text-slate-900 mb-1.5">
              Bem-vindo de volta
            </h1>
            <p className="text-slate-400 text-sm">Entre na sua conta para continuar</p>
          </div>

          {sessionExpired && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-700">Sua sessão expirou. Entre novamente.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-slate-600 text-sm font-medium">
                Usuário
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu usuário"
                required
                disabled={loading}
                className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl text-slate-900 placeholder:text-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-600 text-sm font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="h-11 bg-white border-gray-200 focus:border-green-500 focus:ring-green-500/20 rounded-xl text-slate-900 placeholder:text-slate-300"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 animate-scale-in">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-green-600/25 hover:shadow-md mt-2"
            >
              {loading ? (
                <span className="animate-pulse-soft">Entrando...</span>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-slate-300 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <p className="text-center text-sm text-slate-400">
            Ainda não tem conta?{' '}
            <Link href="/register" className="text-green-600 font-semibold hover:text-green-700 transition-colors">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}
