'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
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
  Utensils,
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

interface DayStats {
  date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  num_meals: number;
  target_calories?: number;
  target_protein_g?: number;
}

interface DailySummary {
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  num_meals: number;
  meals: Array<{ meal_name: string; meal_time: string; total_calories: number }>;
}

const DAY_LABELS: Record<number, string> = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sab' };

export default function ProgressoPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const authFetch = useAuthFetch();
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<DayStats[]>([]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    authFetch('/api/tracking/daily')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDaily(data); })
      .catch(() => {});
    authFetch('/api/tracking/weekly')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.stats) setWeeklyStats(data.stats); })
      .catch(() => {});
  }, [session]);

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

  const calories = Math.round(daily?.totals.calories ?? 0);
  const calTarget = Math.round(daily?.targets.calories ?? 2000);
  const protein = Math.round(daily?.totals.protein_g ?? 0);
  const proteinTarget = Math.round(daily?.targets.protein_g ?? 100);
  const carbs = Math.round(daily?.totals.carbs_g ?? 0);
  const carbsTarget = Math.round(daily?.targets.carbs_g ?? 250);
  const fat = Math.round(daily?.totals.fat_g ?? 0);
  const fatTarget = Math.round(daily?.targets.fat_g ?? 70);

  const chartData = weeklyStats.map((d) => ({
    day: DAY_LABELS[new Date(d.date + 'T12:00:00').getDay()] ?? d.date.slice(5),
    calories: Math.round(d.total_calories),
    target: d.target_calories ? Math.round(d.target_calories) : calTarget,
  }));
  const minCal = chartData.length ? Math.min(...chartData.map((d) => d.calories)) : 0;
  const maxCal = chartData.length ? Math.max(...chartData.map((d) => d.calories)) : 1;
  const calRange = maxCal - minCal || 1;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Progresso" subtitle="Acompanhe sua evolucao" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Overview stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
              {/* Refeicoes hoje */}
              <Card className="p-5 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-verde/20 flex items-center justify-center">
                    <Utensils className="w-4 h-4 text-nutria-verde" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">hoje</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">{daily?.num_meals ?? 0}</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Refeicoes registradas</p>
              </Card>

              {/* Calorias */}
              <Card className="p-5 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-laranja/20 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-nutria-laranja" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">/ {calTarget}</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">{calories}</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">kcal hoje</p>
                <div className="mt-3">
                  <ProgressBar value={calories} max={calTarget} color="bg-nutria-laranja" />
                </div>
              </Card>

              {/* Proteina */}
              <Card className="p-5 bg-gradient-to-br from-nutria-vermelho/10 to-nutria-vermelho/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-vermelho/20 flex items-center justify-center">
                    <Beef className="w-4 h-4 text-nutria-vermelho" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">/ {proteinTarget}g</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">{protein}g</p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Proteina hoje</p>
                <div className="mt-3">
                  <ProgressBar value={protein} max={proteinTarget} color="bg-nutria-vermelho" />
                </div>
              </Card>

              {/* Atividades semana */}
              <Card className="p-5 bg-gradient-to-br from-nutria-bordo/10 to-nutria-bordo/5 border-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-nutria-bordo/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-nutria-bordo" />
                  </div>
                  <span className="text-xs text-nutria-bordo/40">7 dias</span>
                </div>
                <p className="text-2xl font-bold text-nutria-bordo">
                  {weeklyStats.filter((d) => d.num_meals > 0).length}
                </p>
                <p className="text-xs text-nutria-bordo/50 mt-0.5">Dias com registro</p>
                <div className="mt-3">
                  <ProgressBar value={weeklyStats.filter((d) => d.num_meals > 0).length} max={7} color="bg-nutria-bordo" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calorie chart */}
              <Card className="p-6 animate-slide-up stagger-2 opacity-0">
                <h3 className="heading-serif text-lg text-nutria-bordo mb-6">Calorias Semanal</h3>

                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm text-nutria-bordo/40">
                    Nenhum dado registrado esta semana
                  </div>
                ) : (
                  <div className="flex items-end justify-between gap-3 h-48">
                    {chartData.map((d, i) => {
                      const heightPct = ((d.calories - minCal) / calRange) * 60 + 40;
                      const isHighest = d.calories === maxCal;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <span className={`text-xs font-medium ${isHighest ? 'text-nutria-laranja' : 'text-nutria-bordo/50'}`}>
                            {d.calories}
                          </span>
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              isHighest ? 'bg-nutria-laranja' : 'bg-nutria-laranja/30'
                            }`}
                            style={{ height: `${heightPct}%` }}
                          />
                          <span className="text-[11px] text-nutria-bordo/40">{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                      <span className="text-sm text-nutria-bordo/60">{protein} / {proteinTarget}g</span>
                    </div>
                    <ProgressBar value={protein} max={proteinTarget} color="bg-nutria-vermelho" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Wheat className="w-4 h-4 text-nutria-laranja" />
                        <span className="text-sm font-medium text-nutria-bordo">Carboidratos</span>
                      </div>
                      <span className="text-sm text-nutria-bordo/60">{carbs} / {carbsTarget}g</span>
                    </div>
                    <ProgressBar value={carbs} max={carbsTarget} color="bg-nutria-laranja" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-nutria-verde" />
                        <span className="text-sm font-medium text-nutria-bordo">Gordura</span>
                      </div>
                      <span className="text-sm text-nutria-bordo/60">{fat} / {fatTarget}g</span>
                    </div>
                    <ProgressBar value={fat} max={fatTarget} color="bg-nutria-verde" />
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent history */}
            <Card className="p-6 animate-slide-up stagger-4 opacity-0">
              <h3 className="heading-serif text-lg text-nutria-bordo mb-5">Refeicoes de Hoje</h3>

              {!daily || daily.meals.length === 0 ? (
                <p className="text-sm text-nutria-bordo/40 py-4 text-center">Nenhuma refeicao registrada hoje</p>
              ) : (
                <div className="space-y-0 divide-y divide-nutria-creme-dark">
                  {daily.meals.map((meal, i) => (
                    <div key={i} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                      <div className="w-9 h-9 rounded-xl bg-nutria-laranja/10 flex items-center justify-center shrink-0">
                        <Utensils className="w-4 h-4 text-nutria-laranja" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nutria-bordo">{meal.meal_name}</p>
                        <p className="text-xs text-nutria-bordo/50">{Math.round(meal.total_calories)} kcal</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-nutria-bordo/40 shrink-0">
                        <Clock className="w-3 h-3" />
                        {meal.meal_time}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
