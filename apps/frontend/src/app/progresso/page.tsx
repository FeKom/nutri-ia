'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import {
  TrendingUp,
  Scale,
  Flame,
  Beef,
  Activity,
  ArrowDown,
  ArrowUp,
  Utensils,
  Footprints,
  Dumbbell,
  Clock,
  Wheat,
  Droplets,
} from 'lucide-react';

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-3 bg-nutria-creme-dark rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const weightData = [
  { day: 'Seg', weight: 73.1 },
  { day: 'Ter', weight: 72.8 },
  { day: 'Qua', weight: 72.9 },
  { day: 'Qui', weight: 72.5 },
  { day: 'Sex', weight: 72.3 },
  { day: 'Sab', weight: 72.6 },
  { day: 'Dom', weight: 72.5 },
];

const recentEntries = [
  { icon: Utensils, label: 'Almoco registrado', detail: '650 kcal', time: '2h atras', color: 'text-nutria-laranja', bg: 'bg-nutria-laranja/10' },
  { icon: Footprints, label: 'Caminhada', detail: '30min - 180 kcal', time: '5h atras', color: 'text-nutria-verde', bg: 'bg-nutria-verde/10' },
  { icon: Utensils, label: 'Cafe da manha', detail: '420 kcal', time: '8h atras', color: 'text-nutria-laranja', bg: 'bg-nutria-laranja/10' },
  { icon: Dumbbell, label: 'Musculacao', detail: '45min - 320 kcal', time: 'Ontem', color: 'text-nutria-bordo', bg: 'bg-nutria-bordo/10' },
  { icon: Utensils, label: 'Jantar registrado', detail: '580 kcal', time: 'Ontem', color: 'text-nutria-laranja', bg: 'bg-nutria-laranja/10' },
];

export default function ProgressoPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-nutria-verde animate-pulse-soft" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Carregando progresso...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const minWeight = Math.min(...weightData.map((d) => d.weight));
  const maxWeight = Math.max(...weightData.map((d) => d.weight));
  const weightRange = maxWeight - minWeight || 1;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Progresso" subtitle="Acompanhe sua evolucao" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
              {/* Peso */}
              <Card className="p-5 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-verde/20 flex items-center justify-center">
                    <Scale className="w-4 h-4 text-nutria-verde" />
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-nutria-verde">
                    <ArrowDown className="w-3 h-3" />
                    -1.2 kg
                  </span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">72.5 kg</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Peso atual</p>
              </Card>

              {/* Calorias */}
              <Card className="p-5 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-laranja/20 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-nutria-laranja" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">/ 2.200</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">1.850</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">kcal hoje</p>
                <div className="mt-3">
                  <ProgressBar value={1850} max={2200} color="bg-nutria-laranja" />
                </div>
              </Card>

              {/* Proteina */}
              <Card className="p-5 bg-gradient-to-br from-nutria-vermelho/10 to-nutria-vermelho/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-vermelho/20 flex items-center justify-center">
                    <Beef className="w-4 h-4 text-nutria-vermelho" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">/ 120g</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">95g</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Proteina hoje</p>
                <div className="mt-3">
                  <ProgressBar value={95} max={120} color="bg-nutria-vermelho" />
                </div>
              </Card>

              {/* Atividades */}
              <Card className="p-5 bg-gradient-to-br from-nutria-bordo/10 to-nutria-bordo/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-bordo/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-nutria-bordo" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">/ 5</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">4</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Atividades semana</p>
                <div className="mt-3">
                  <ProgressBar value={4} max={5} color="bg-nutria-bordo" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weight chart */}
              <Card className="p-6 animate-slide-up stagger-2 opacity-0">
                <h3 className="heading-serif text-lg text-nutria-bordo mb-6">Peso Semanal</h3>

                <div className="flex items-end justify-between gap-3 h-48">
                  {weightData.map((d, i) => {
                    const heightPct = ((d.weight - minWeight) / weightRange) * 60 + 40;
                    const isLowest = d.weight === minWeight;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className={`text-xs font-medium ${isLowest ? 'text-nutria-verde' : 'text-nutria-bordo/50'}`}>
                          {d.weight}
                        </span>
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isLowest ? 'bg-nutria-verde' : 'bg-nutria-verde/30'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[11px] text-nutria-bordo/40">{d.day}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Macros today */}
              <Card className="p-6 animate-slide-up stagger-3 opacity-0">
                <h3 className="heading-serif text-lg text-nutria-bordo mb-6">Macros de Hoje</h3>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Beef className="w-4 h-4 text-nutria-vermelho" />
                        <span className="text-sm font-medium text-nutria-bordo">Proteina</span>
                      </div>
                      <span className="text-sm text-nutria-bordo/60">95 / 120g</span>
                    </div>
                    <ProgressBar value={95} max={120} color="bg-nutria-vermelho" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Wheat className="w-4 h-4 text-nutria-laranja" />
                        <span className="text-sm font-medium text-nutria-bordo">Carboidratos</span>
                      </div>
                      <span className="text-sm text-nutria-bordo/60">210 / 250g</span>
                    </div>
                    <ProgressBar value={210} max={250} color="bg-nutria-laranja" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-nutria-verde" />
                        <span className="text-sm font-medium text-nutria-bordo">Gordura</span>
                      </div>
                      <span className="text-sm text-nutria-bordo/60">55 / 70g</span>
                    </div>
                    <ProgressBar value={55} max={70} color="bg-nutria-verde" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent history */}
            <Card className="p-6 animate-slide-up stagger-4 opacity-0">
              <h3 className="heading-serif text-lg text-nutria-bordo mb-5">Historico Recente</h3>

              <div className="space-y-0 divide-y divide-nutria-creme-dark">
                {recentEntries.map((entry, i) => {
                  const Icon = entry.icon;
                  return (
                    <div key={i} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                      <div className={`w-9 h-9 rounded-xl ${entry.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${entry.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nutria-bordo">{entry.label}</p>
                        <p className="text-xs text-nutria-bordo/50">{entry.detail}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-nutria-bordo/40 shrink-0">
                        <Clock className="w-3 h-3" />
                        {entry.time}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
