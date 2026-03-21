'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Trash2, Edit, X, Flame, Beef, Wheat, Droplets, Sparkles, UserPen, FileDown } from 'lucide-react';

interface MealPlan {
  id: string;
  plan_name: string;
  description?: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_fat_g: number;
  daily_carbs_g: number;
  created_by: string;
  created_at: string;
}

export default function DietasPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const authFetch = useAuthFetch();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchMealPlans();
    }
  }, [session]);

  const fetchMealPlans = async () => {
    try {
      const response = await authFetch('/api/meal-plans');

      if (response.ok) {
        const data = await response.json();
        setMealPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    router.push('/chat?prompt=' + encodeURIComponent('Crie uma dieta personalizada para mim'));
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      const response = await authFetch(`/api/meal-plans/${planId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchMealPlans();
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error);
    }
  };

  const handleDownloadPdf = async (planId: string, planName: string) => {
    try {
      const response = await authFetch(`/api/meal-plans/${planId}/pdf`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${planName}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  if (isPending || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center">
            <Flame className="w-5 h-5 text-nutria-verde animate-pulse-soft" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Carregando dietas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Planos Alimentares" subtitle="Gerencie suas dietas e metas nutricionais" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header com acao */}
            <div className="flex items-center justify-between mb-8 animate-slide-up">
              <div>
                <h1 className="heading-serif text-3xl text-nutria-bordo mb-1">
                  Meus Planos
                </h1>
                <p className="text-sm text-nutria-bordo/50">
                  {mealPlans.length} {mealPlans.length === 1 ? 'plano criado' : 'planos criados'}
                </p>
              </div>
              <Button
                onClick={handleCreatePlan}
                className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </div>

            {/* Lista de planos */}
            {mealPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-nutria-verde/10 flex items-center justify-center mb-6">
                  <Flame className="w-10 h-10 text-nutria-verde/40" />
                </div>
                <h3 className="heading-serif text-xl text-nutria-bordo mb-2">
                  Nenhum plano criado ainda
                </h3>
                <p className="text-sm text-nutria-bordo/50 mb-8 max-w-sm text-center">
                  Crie seu primeiro plano alimentar com ajuda da IA para comecar sua jornada
                </p>
                <Button
                  onClick={handleCreatePlan}
                  className="bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Criar com IA
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mealPlans.map((plan, index) => (
                  <Card
                    key={plan.id}
                    className={`group p-0 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-transparent hover:border-nutria-verde/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    {/* Badge bar */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          plan.created_by === 'ai'
                            ? 'bg-nutria-verde/10 text-nutria-verde'
                            : 'bg-nutria-bordo/10 text-nutria-bordo'
                        }`}
                      >
                        {plan.created_by === 'ai' ? (
                          <><Sparkles className="w-3 h-3" /> IA</>
                        ) : (
                          <><UserPen className="w-3 h-3" /> Manual</>
                        )}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlan(plan.id);
                        }}
                        className="p-1.5 rounded-lg text-nutria-bordo/20 hover:text-nutria-vermelho hover:bg-nutria-vermelho/5 transition-all duration-200 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                      <h3 className="font-semibold text-nutria-bordo mb-1 line-clamp-1">
                        {plan.plan_name}
                      </h3>
                      {plan.description && (
                        <p className="text-sm text-nutria-bordo/50 line-clamp-2 mb-4">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Macros grid */}
                    <div className="grid grid-cols-4 gap-0 border-t border-nutria-creme-dark">
                      <div className="p-3 text-center border-r border-nutria-creme-dark">
                        <Flame className="w-3.5 h-3.5 text-nutria-laranja mx-auto mb-1" />
                        <p className="text-xs font-semibold text-nutria-bordo">{plan.daily_calories}</p>
                        <p className="text-[10px] text-nutria-bordo/40">kcal</p>
                      </div>
                      <div className="p-3 text-center border-r border-nutria-creme-dark">
                        <Beef className="w-3.5 h-3.5 text-nutria-vermelho mx-auto mb-1" />
                        <p className="text-xs font-semibold text-nutria-bordo">{plan.daily_protein_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">prot</p>
                      </div>
                      <div className="p-3 text-center border-r border-nutria-creme-dark">
                        <Wheat className="w-3.5 h-3.5 text-nutria-laranja mx-auto mb-1" />
                        <p className="text-xs font-semibold text-nutria-bordo">{plan.daily_carbs_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">carb</p>
                      </div>
                      <div className="p-3 text-center">
                        <Droplets className="w-3.5 h-3.5 text-nutria-verde mx-auto mb-1" />
                        <p className="text-xs font-semibold text-nutria-bordo">{plan.daily_fat_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">gord</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 bg-nutria-creme/50 flex items-center text-[11px] text-nutria-bordo/40">
                      <Calendar className="w-3 h-3 mr-1.5" />
                      {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalhes */}
      {selectedPlan && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setSelectedPlan(null)}
        >
          <Card
            className="max-w-lg w-full p-0 overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex-1">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-3 ${
                    selectedPlan.created_by === 'ai'
                      ? 'bg-nutria-verde/10 text-nutria-verde'
                      : 'bg-nutria-bordo/10 text-nutria-bordo'
                  }`}
                >
                  {selectedPlan.created_by === 'ai' ? (
                    <><Sparkles className="w-3 h-3" /> Criado por IA</>
                  ) : (
                    <><UserPen className="w-3 h-3" /> Criado manualmente</>
                  )}
                </span>
                <h2 className="heading-serif text-2xl text-nutria-bordo">
                  {selectedPlan.plan_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="p-2 rounded-xl hover:bg-nutria-creme-dark transition-colors"
              >
                <X className="w-5 h-5 text-nutria-bordo/40" />
              </button>
            </div>

            {selectedPlan.description && (
              <p className="px-6 pb-4 text-sm text-nutria-bordo/60 leading-relaxed">
                {selectedPlan.description}
              </p>
            )}

            {/* Macros detalhados */}
            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              <div className="p-4 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 rounded-2xl">
                <Flame className="w-5 h-5 text-nutria-laranja mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedPlan.daily_calories}</p>
                <p className="text-xs text-nutria-bordo/50">kcal / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-vermelho/10 to-nutria-vermelho/5 rounded-2xl">
                <Beef className="w-5 h-5 text-nutria-vermelho mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedPlan.daily_protein_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Proteina / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 rounded-2xl">
                <Wheat className="w-5 h-5 text-nutria-laranja mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedPlan.daily_carbs_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Carboidratos / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 rounded-2xl">
                <Droplets className="w-5 h-5 text-nutria-verde mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedPlan.daily_fat_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Gordura / dia</p>
              </div>
            </div>

            {/* Acoes */}
            <div className="flex gap-3 p-6 pt-0">
              <Button
                onClick={() => handleDownloadPdf(selectedPlan.id, selectedPlan.plan_name)}
                variant="outline"
                className="flex-1 rounded-xl border-nutria-creme-dark hover:border-nutria-verde/30"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
              <Button
                onClick={() => {
                  router.push(`/chat?prompt=${encodeURIComponent(`Edite o plano ${selectedPlan.plan_name}`)}`);
                }}
                className="flex-1 bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar com IA
              </Button>
            </div>

            {/* Date footer */}
            <div className="px-6 py-3 bg-nutria-creme/50 border-t border-nutria-creme-dark flex items-center text-xs text-nutria-bordo/40">
              <Calendar className="w-3 h-3 mr-1.5" />
              Criado em {new Date(selectedPlan.created_at).toLocaleDateString('pt-BR')}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
