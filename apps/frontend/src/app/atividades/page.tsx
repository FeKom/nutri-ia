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
  Activity,
  Footprints,
  Zap,
  Dumbbell,
  Waves,
  Bike,
  Heart,
  CircleDot,
  Clock,
  Flame,
  Plus,
  Trash2,
  X,
  Calendar,
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  type: string;
  duration_minutes: number;
  calories_burned: number;
  date: string;
  notes?: string;
}

const activityIcons: Record<string, any> = {
  caminhada: Footprints,
  corrida: Zap,
  musculacao: Dumbbell,
  natacao: Waves,
  ciclismo: Bike,
  yoga: Heart,
  outro: CircleDot,
};

const activityLabels: Record<string, string> = {
  caminhada: 'Caminhada',
  corrida: 'Corrida',
  musculacao: 'Musculacao',
  natacao: 'Natacao',
  ciclismo: 'Ciclismo',
  yoga: 'Yoga',
  outro: 'Outro',
};

const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);

const initialActivities: ActivityEntry[] = [];

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export default function AtividadesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [activities, setActivities] = useState<ActivityEntry[]>(initialActivities);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formType, setFormType] = useState('caminhada');
  const [formDuration, setFormDuration] = useState('');
  const [formCalories, setFormCalories] = useState('');
  const [formDate, setFormDate] = useState(daysAgo(0));
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  const handleAdd = () => {
    if (!formDuration || !formCalories) return;

    const newActivity: ActivityEntry = {
      id: crypto.randomUUID(),
      type: formType,
      duration_minutes: parseInt(formDuration),
      calories_burned: parseInt(formCalories),
      date: formDate,
      notes: formNotes || undefined,
    };

    setActivities((prev) => [newActivity, ...prev]);
    setShowForm(false);
    setFormType('caminhada');
    setFormDuration('');
    setFormCalories('');
    setFormDate(daysAgo(0));
    setFormNotes('');
  };

  const handleDelete = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // Stats
  const weekActivities = activities.filter((a) => {
    const diff = (today.getTime() - new Date(a.date).getTime()) / 86400000;
    return diff <= 7;
  });
  const totalMinutes = weekActivities.reduce((sum, a) => sum + a.duration_minutes, 0);
  const totalCalories = weekActivities.reduce((sum, a) => sum + a.calories_burned, 0);

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-nutria-verde animate-pulse-soft" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Carregando atividades...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Atividades" subtitle="Registre e acompanhe seus exercicios" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-up">
              <Card className="p-5 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-verde/20 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-nutria-verde" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{weekActivities.length}</p>
                    <p className="text-xs text-nutria-bordo/50">Atividades esta semana</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-laranja/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-nutria-laranja" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{formatDuration(totalMinutes)}</p>
                    <p className="text-xs text-nutria-bordo/50">Tempo total</p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 bg-gradient-to-br from-nutria-bordo/10 to-nutria-bordo/5 border-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nutria-bordo/20 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-nutria-bordo" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-nutria-bordo">{totalCalories.toLocaleString()}</p>
                    <p className="text-xs text-nutria-bordo/50">Calorias queimadas</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Header + add button */}
            <div className="flex items-center justify-between mb-6 animate-slide-up stagger-2 opacity-0">
              <div>
                <h2 className="heading-serif text-2xl text-nutria-bordo">Historico</h2>
                <p className="text-sm text-nutria-bordo/50">{activities.length} atividades registradas</p>
              </div>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Atividade
              </Button>
            </div>

            {/* Activity list */}
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-nutria-verde/10 flex items-center justify-center mb-6">
                  <Activity className="w-10 h-10 text-nutria-verde/40" />
                </div>
                <h3 className="heading-serif text-xl text-nutria-bordo mb-2">Nenhuma atividade</h3>
                <p className="text-sm text-nutria-bordo/50 mb-8">Registre sua primeira atividade fisica</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Registrar Atividade
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, index) => {
                  const Icon = activityIcons[activity.type] || CircleDot;
                  return (
                    <Card
                      key={activity.id}
                      className={`group p-4 flex items-center gap-4 hover:shadow-md transition-all duration-200 border-transparent hover:border-nutria-verde/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-nutria-verde" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-nutria-bordo">
                          {activityLabels[activity.type] || activity.type}
                        </p>
                        {activity.notes && (
                          <p className="text-sm text-nutria-bordo/50 truncate">{activity.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-5 text-sm text-nutria-bordo/60 shrink-0">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(activity.duration_minutes)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5" />
                          {activity.calories_burned} kcal
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(activity.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="p-1.5 rounded-lg text-nutria-bordo/20 hover:text-nutria-vermelho hover:bg-nutria-vermelho/5 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add activity modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowForm(false)}
        >
          <Card
            className="max-w-md w-full p-0 overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-4">
              <h2 className="heading-serif text-xl text-nutria-bordo">Nova Atividade</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 rounded-xl hover:bg-nutria-creme-dark transition-colors"
              >
                <X className="w-5 h-5 text-nutria-bordo/40" />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Tipo de atividade</Label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="h-11 w-full bg-white border border-nutria-creme-dark rounded-xl px-3 text-sm text-nutria-bordo focus:border-nutria-verde outline-none transition-colors"
                >
                  {Object.entries(activityLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-nutria-bordo/70 text-sm font-medium">Duracao (min)</Label>
                  <Input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    placeholder="30"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-nutria-bordo/70 text-sm font-medium">Calorias</Label>
                  <Input
                    type="number"
                    value={formCalories}
                    onChange={(e) => setFormCalories(e.target.value)}
                    placeholder="200"
                    className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Data</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-nutria-bordo/70 text-sm font-medium">Observacoes (opcional)</Label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: treino leve, foco em pernas..."
                  className="h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <Button
                onClick={handleAdd}
                disabled={!formDuration || !formCalories}
                className="w-full bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl mt-2"
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Atividade
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
