'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Leaf, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message || 'Email ou senha invalidos. Tente novamente.');
        setLoading(false);
        return;
      }

      window.location.href = '/chat';
    } catch (err: any) {
      setError(err.message || 'Email ou senha invalidos. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-nutria-creme grain">
      {/* Lado esquerdo -- Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-nutria-verde to-nutria-verde-light relative overflow-hidden">
        {/* Elementos decorativos */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border-2 border-white" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full border border-white" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full border border-white" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Leaf className="w-6 h-6" />
            </div>
            <span className="heading-serif text-2xl">nutri.a</span>
          </div>

          <div className="max-w-md">
            <h2 className="heading-serif text-4xl leading-tight mb-4">
              Sua jornada para uma vida mais saudavel comeca aqui.
            </h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Planejamento nutricional inteligente, receitas personalizadas
              e acompanhamento do seu progresso com IA.
            </p>
          </div>

          <p className="text-white/40 text-sm">
            Nutricao inteligente, resultados reais.
          </p>
        </div>
      </div>

      {/* Lado direito -- Formulario */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-12 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-nutria-verde flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="heading-serif text-2xl text-nutria-bordo">nutri.a</span>
          </div>

          {/* Titulo */}
          <div className="mb-8">
            <h1 className="heading-serif text-3xl text-nutria-bordo mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-nutria-bordo/50">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-nutria-bordo/70 text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                disabled={loading}
                className="h-12 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl transition-all duration-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-nutria-bordo/70 text-sm font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                disabled={loading}
                className="h-12 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl transition-all duration-200"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-nutria-vermelho/5 border border-nutria-vermelho/15 animate-scale-in">
                <p className="text-sm text-nutria-vermelho">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-nutria-bordo hover:bg-nutria-bordo/90 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
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

          {/* Divider */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-nutria-creme-dark" />
            <span className="text-xs text-nutria-bordo/30 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-nutria-creme-dark" />
          </div>

          {/* Link registro */}
          <p className="text-center text-sm text-nutria-bordo/50">
            Ainda nao tem conta?{' '}
            <Link
              href="/register"
              className="text-nutria-verde font-medium hover:text-nutria-verde-light transition-colors"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
