'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
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
  peso: { label: 'Peso', icon: Scale, color: 'text-nutria-verde', bg: 'bg-nutria-verde/10' },
  nutricao: { label: 'Nutricao', icon: Flame, color: 'text-nutria-laranja', bg: 'bg-nutria-laranja/10' },
  atividade: { label: 'Atividade', icon: Activity, color: 'text-nutria-bordo', bg: 'bg-nutria-bordo/10' },
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
  if (pct >= 80) return 'bg-nutria-verde';
  if (pct >= 50) return 'bg-nutria-laranja';
  return 'bg-nutria-vermelho';
}

export default function MetasPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
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

  const handleAdd = () => {
    if (!formTitle || !formTarget || !formCurrent || !formUnit) return;

    const newMeta: Meta = {
      id: crypto.randomUUID(),
      title: formTitle,
      description: formDescription || undefined,
      target_value: parseFloat(formTarget),
      current_value: parseFloat(formCurrent),
      unit: formUnit,
      category: formCategory,
      deadline: formDeadline || undefined,
      created_at: new Date().toISOString().slice(0, 10),
    };

    setMetas((prev) => [newMeta, ...prev]);
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

  const handleDelete = (id: string) => {
    setMetas((prev) => prev.filter((m) => m.id !== id));
  };

  // Stats
  const completedCount = metas.filter((m) => getProgress(m) >= 100).length;
  const avgProgress = metas.length > 0
    ? Math.round(metas.reduce((sum, m) => sum + getProgress(m), 0) / metas.length)
    : 0;

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center">
            <Target className="w-5 h-5 text-nutria-verde animate-pulse-soft" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Carregando metas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Metas" subtitle="Defina e acompanhe seus objetivos" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-up">
              <Card className="p-5 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-verde/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-nutria-verde" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{metas.length}</p>
                    <p className="text-xs text-nutria-bordo/50">Metas ativas</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-laranja/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-nutria-laranja" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{avgProgress}%</p>
                    <p className="text-xs text-nutria-bordo/50">Progresso medio</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-nutria-bordo/10 to-nutria-bordo/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-bordo/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-nutria-bordo" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{completedCount}</p>
                    <p className="text-xs text-nutria-bordo/50">Metas concluidas</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Header + add */}
            <div className="flex items-center justify-between mb-6 animate-slide-up stagger-2 opacity-0">
              <div>
                <h2 className="heading-serif text-2xl text-nutria-bordo">Minhas Metas</h2>
                <p className="text-sm text-nutria-bordo/50">Acompanhe o progresso de cada objetivo</p>
              </div>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Meta
              </Button>
            </div>

            {/* Goals list */}
            {metas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-nutria-verde/10 flex items-center justify-center mb-6">
                  <Target className="w-10 h-10 text-nutria-verde/40" />
                </div>
                <h3 className="heading-serif text-xl text-nutria-bordo mb-2">Nenhuma meta definida</h3>
                <p className="text-sm text-nutria-bordo/50 mb-8 max-w-sm text-center">
                  Defina metas para acompanhar seu progresso nutricional e fisico
                </p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl"
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
                      className={`group p-0 overflow-hidden transition-all duration-300 hover:shadow-lg border-transparent hover:border-nutria-verde/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
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
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-nutria-verde/10 text-nutria-verde text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Concluida
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(meta.id)}
                            className="p-1.5 rounded-lg text-nutria-bordo/20 hover:text-nutria-vermelho hover:bg-nutria-vermelho/5 transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="px-5 py-4">
                        <h3 className="font-semibold text-nutria-bordo mb-1">{meta.title}</h3>
                        {meta.description && (
                          <p className="text-sm text-nutria-bordo/50 line-clamp-2 mb-4">
                            {meta.description}
                          </p>
                        )}

                        {/* Progress */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-nutria-bordo/60">
                              {meta.current_value} / {meta.target_value} {meta.unit}
                            </span>
                            <span className="font-medium text-nutria-bordo">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-nutria-creme-dark rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressColor} transition-all duration-700 ease-out`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      {meta.deadline && (
                        <div className="px-5 py-3 bg-nutria-creme/50 border-t border-nutria-creme-dark flex items-center text-[11px] text-nutria-bordo/40">
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
              <h2 className="heading-serif text-xl text-nutria-bordo">Nova Meta</h2>
              <button
                onClick={resetForm}
                className="p-2 rounded-xl hover:bg-nutria-creme-dark transition-colors"
              >
                <X className="w-5 h-5 text-nutria-bordo/40" />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Titulo</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Chegar a 68kg, Comer 120g proteina/dia"
                  className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Descricao (opcional)</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detalhes sobre o objetivo"
                  className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Categoria</Label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as 'peso' | 'nutricao' | 'atividade')}
                  className="h-11 w-full bg-white border border-nutria-creme-dark rounded-xl px-3 text-sm text-nutria-bordo focus:border-nutria-verde outline-none transition-colors"
                >
                  <option value="peso">Peso</option>
                  <option value="nutricao">Nutricao</option>
                  <option value="atividade">Atividade</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-nutria-bordo/70 text-sm font-medium">Valor atual</Label>
                  <Input
                    type="number"
                    value={formCurrent}
                    onChange={(e) => setFormCurrent(e.target.value)}
                    placeholder="72.5"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-nutria-bordo/70 text-sm font-medium">Valor alvo</Label>
                  <Input
                    type="number"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="68"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-nutria-bordo/70 text-sm font-medium">Unidade</Label>
                  <Input
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="kg, g, kcal"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Prazo (opcional)</Label>
                <Input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <Button
                onClick={handleAdd}
                disabled={!formTitle || !formTarget || !formCurrent || !formUnit}
                className="w-full bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl mt-2"
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
