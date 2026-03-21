'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, LogOut, Save, Shield, CheckCircle } from 'lucide-react';

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setEmail(session.user.email || '');
    }
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');

    try {
      // TODO: chamar API pra atualizar o perfil quando o backend suportar
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setMessage('Perfil atualizado com sucesso!');
    } catch (error) {
      setMessage('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <p className="text-sm text-nutria-bordo/50 animate-fade-in">Carregando...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Configuracoes" subtitle="Gerencie seu perfil e preferencias" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Perfil */}
            <Card className="p-0 overflow-hidden animate-slide-up">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-nutria-creme-dark bg-nutria-creme/30">
                <div className="w-8 h-8 rounded-lg bg-nutria-verde/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-nutria-verde" />
                </div>
                <h2 className="font-semibold text-nutria-bordo">Meu Perfil</h2>
              </div>

              <div className="p-6 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4 pb-5 border-b border-nutria-creme-dark">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nutria-verde to-nutria-verde-light flex items-center justify-center shadow-sm">
                    <span className="text-2xl font-bold text-white">
                      {name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-nutria-bordo">{name || 'Usuario'}</p>
                    <p className="text-sm text-nutria-bordo/50">{email}</p>
                  </div>
                </div>

                {/* Campos */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-nutria-bordo/70 text-sm font-medium">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-nutria-bordo/70 text-sm font-medium">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="h-11 bg-nutria-creme/50 border-nutria-creme-dark rounded-xl cursor-not-allowed"
                  />
                </div>

                {/* Mensagem de feedback */}
                {message && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm animate-scale-in ${
                      message.includes('sucesso')
                        ? 'bg-nutria-verde/10 text-nutria-verde'
                        : 'bg-nutria-vermelho/10 text-nutria-vermelho'
                    }`}
                  >
                    {message.includes('sucesso') && <CheckCircle className="w-4 h-4 shrink-0" />}
                    {message}
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl transition-all duration-200"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Alteracoes'}
                </Button>
              </div>
            </Card>

            {/* Conta */}
            <Card className="p-0 overflow-hidden animate-slide-up stagger-2 opacity-0">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-nutria-creme-dark bg-nutria-creme/30">
                <div className="w-8 h-8 rounded-lg bg-nutria-laranja/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-nutria-laranja" />
                </div>
                <h2 className="font-semibold text-nutria-bordo">Conta</h2>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between p-4 bg-nutria-creme/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-nutria-bordo">Plano atual</p>
                    <p className="text-sm text-nutria-bordo/50 capitalize mt-0.5">
                      {session.user.planType || 'Free'}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-nutria-verde/10 text-nutria-verde text-xs font-medium rounded-lg">
                    Ativo
                  </div>
                </div>
              </div>
            </Card>

            {/* Sair */}
            <Card className="p-0 overflow-hidden border-nutria-vermelho/10 animate-slide-up stagger-3 opacity-0">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-nutria-creme-dark bg-nutria-creme/30">
                <div className="w-8 h-8 rounded-lg bg-nutria-vermelho/10 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-nutria-vermelho" />
                </div>
                <h2 className="font-semibold text-nutria-bordo">Sessao</h2>
              </div>

              <div className="p-6">
                <p className="text-sm text-nutria-bordo/50 mb-4">
                  Encerre sua sessao atual. Voce precisara fazer login novamente.
                </p>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-nutria-vermelho/20 text-nutria-vermelho hover:bg-nutria-vermelho/5 rounded-xl transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da conta
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
