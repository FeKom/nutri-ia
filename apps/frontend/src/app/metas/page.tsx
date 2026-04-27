'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Target,
  Plus,
  Trash2,
  X,
  Scale,
  Beef,
  Flame,
  Activity,
  Calendar,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

interface Meta {
  id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  category: 'peso' | 'nutricao' | 'atividade';
  deadline?: string;
  created_at: string;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  peso: { label: 'Peso', icon: Scale, color: 'text-green-600', bg: 'bg-green-50' },
  nutricao: { label: 'Nutricao', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-500/10' },
  atividade: { label: 'Atividade', icon: Activity, color: 'text-slate-900', bg: 'bg-slate-900/10' },
};

const initialMetas: Meta[] = [];

function getProgress(meta: Meta): number {
  // Para metas de peso onde o objetivo e diminuir
  if (meta.category === 'peso' && meta.target_value < meta.current_value) {
    const start = meta.current_value + (meta.current_value - meta.target_value);
    const total = start - meta.target_value;
    const done = start - meta.current_value;
    return Math.min(Math.max((done / total) * 100, 0), 100);
  }

  // Para metas onde o objetivo e um limite maximo (ex: calorias)
  if (meta.current_value <= meta.target_value) {
    return Math.min((meta.current_value / meta.target_value) * 100, 100);
  }

  return Math.min((meta.target_value / meta.current_value) * 100, 100);
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-600';
  if (pct >= 50) return 'bg-orange-500';
  return 'bg-red-600';
}

export default function MetasPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const authFetch = useAuthFetch();
  const [metas, setMetas] = useState<Meta[]>(initialMetas);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formCurrent, setFormCurrent] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formCategory, setFormCategory] = useState<'peso' | 'nutricao' | 'atividade'>('nutricao');
  const [formDeadline, setFormDeadline] = useState('');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    authFetch('/api/goals')
      .then((r) => r.ok ? r.json() : [])
      .then((data: Meta[]) => setMetas(data))
      .catch(() => {});
  }, [session]);

  const handleAdd = async () => {
    if (!formTitle || !formTarget || !formCurrent || !formUnit) return;

    const body = {
      title: formTitle,
      description: formDescription || undefined,
      target_value: parseFloat(formTarget),
      current_value: parseFloat(formCurrent),
      unit: formUnit,
      category: formCategory,
      deadline: formDeadline || undefined,
    };

    const res = await authFetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const newMeta: Meta = await res.json();
      setMetas((prev) => [newMeta, ...prev]);
    }
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setFormTitle('');
    setFormDescription('');
    setFormTarget('');
    setFormCurrent('');
    setFormUnit('');
    setFormCategory('nutricao');
    setFormDeadline('');
  };

  const handleDelete = async (id: string) => {
    const res = await authFetch(`/api/goals/${id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      setMetas((prev) => prev.filter((m) => m.id !== id));
    }
  };

  // Stats
  const completedCount = metas.filter((m) => getProgress(m) >= 100).length;
  const avgProgress = metas.length > 0
    ? Math.round(metas.reduce((sum, m) => sum + getProgress(m), 0) / metas.length)
    : 0;

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Target className="w-5 h-5 text-green-600 animate-pulse-soft" />
          </div>
          <p className="text-sm text-slate-400">Carregando metas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Metas" subtitle="Defina e acompanhe seus objetivos" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-up">
              <Card className="p-5 bg-gradient-to-br from-green-600/10 to-green-600/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
                    <Target className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{metas.length}</p>
                    <p className="text-xs text-slate-400">Metas ativas</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{avgProgress}%</p>
                    <p className="text-xs text-slate-400">Progresso medio</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-slate-900/10 to-slate-900/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-slate-900" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
                    <p className="text-xs text-slate-400">Metas concluidas</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Header + add */}
            <div className="flex items-center justify-between mb-6 animate-slide-up stagger-2 opacity-0">
              <div>
                <h2 className="heading-serif text-2xl text-slate-900">Minhas Metas</h2>
                <p className="text-sm text-slate-400">Acompanhe o progresso de cada objetivo</p>
              </div>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-green-600 hover:bg-green-600-light text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Meta
              </Button>
            </div>

            {/* Goals list */}
            {metas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mb-6">
                  <Target className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="heading-serif text-xl text-slate-900 mb-2">Nenhuma meta definida</h3>
                <p className="text-sm text-slate-400 mb-8 max-w-sm text-center">
                  Defina metas para acompanhar seu progresso nutricional e fisico
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-green-600 hover:bg-green-600-light text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Meta
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {metas.map((meta, index) => {
                  const config = categoryConfig[meta.category];
                  const Icon = config.icon;
                  const progress = getProgress(meta);
                  const progressColor = getProgressColor(progress);
                  const isComplete = progress >= 100;

                  return (
                    <Card
                      key={meta.id}
                      className={`group p-0 overflow-hidden transition-all duration-300 hover:shadow-lg border-transparent hover:border-green-600/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between px-5 pt-5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <span className={`text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isComplete && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 text-green-600 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Concluida
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(meta.id)}
                            className="p-1.5 rounded-lg text-slate-900/20 hover:text-red-600 hover:bg-red-600/5 transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="px-5 py-4">
                        <h3 className="font-semibold text-slate-900 mb-1">{meta.title}</h3>
                        {meta.description && (
                          <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                            {meta.description}
                          </p>
                        )}

                        {/* Progress */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                              {meta.current_value} / {meta.target_value} {meta.unit}
                            </span>
                            <span className="font-medium text-slate-900">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressColor} transition-all duration-700 ease-out`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      {meta.deadline && (
                        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-200 flex items-center text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3 mr-1.5" />
                          Prazo: {new Date(meta.deadline).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add meta modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={resetForm}
        >
          <Card
            className="max-w-md w-full p-0 overflow-hidden shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="heading-serif text-xl text-slate-900">Nova Meta</h2>
              <button
                onClick={resetForm}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-900/70 text-sm font-medium">Titulo</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Chegar a 68kg, Comer 120g proteina/dia"
                  className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900/70 text-sm font-medium">Descricao (opcional)</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalhes sobre o objetivo"
                  className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900/70 text-sm font-medium">Categoria</Label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as 'peso' | 'nutricao' | 'atividade')}
                  className="h-11 w-full bg-white border border-gray-200 rounded-xl px-3 text-sm text-slate-900 focus:border-green-600 outline-none transition-colors"
                >
                  <option value="peso">Peso</option>
                  <option value="nutricao">Nutricao</option>
                  <option value="atividade">Atividade</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-slate-900/70 text-sm font-medium">Valor atual</Label>
                  <Input
                    type="number"
                    value={formCurrent}
                    onChange={(e) => setFormCurrent(e.target.value)}
                    placeholder="72.5"
                    className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900/70 text-sm font-medium">Valor alvo</Label>
                  <Input
                    type="number"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="68"
                    className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-900/70 text-sm font-medium">Unidade</Label>
                  <Input
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="kg, g, kcal"
                    className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900/70 text-sm font-medium">Prazo (opcional)</Label>
                <Input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                />
              </div>

              <Button
                onClick={handleAdd}
                disabled={!formTitle || !formTarget || !formCurrent || !formUnit}
                className="w-full bg-green-600 hover:bg-green-600-light text-white rounded-xl mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Meta
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
