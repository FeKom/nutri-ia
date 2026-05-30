'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Trash2, Edit, X, Flame, Beef, Wheat, Droplets, Sparkles, UserPen, FileDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

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
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [pdfToast, setPdfToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const showPdfToast = (type: 'success' | 'error', message: string) => {
    setPdfToast({ type, message });
    setTimeout(() => setPdfToast(null), 3500);
  };

  const handleDownloadPdf = async (planId: string, planName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (downloadingPdf) return;
    setDownloadingPdf(planId);
    try {
      const response = await authFetch(`/api/meal-plans/${planId}/pdf`);

      if (!response.ok) throw new Error(`status ${response.status}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${planName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showPdfToast('success', `PDF "${planName}" baixado com sucesso!`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showPdfToast('error', 'Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (isPending || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <Flame className="w-5 h-5 text-green-600 animate-pulse-soft" />
          </div>
          <p className="text-sm text-slate-400">Carregando dietas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Planos Alimentares" subtitle="Gerencie suas dietas e metas nutricionais" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header com acao */}
            <div className="flex items-center justify-between mb-8 animate-slide-up">
              <div>
                <h1 className="heading-serif text-3xl text-slate-900 mb-1">
                  Meus Planos
                </h1>
                <p className="text-sm text-slate-400">
                  {mealPlans.length} {mealPlans.length === 1 ? 'plano criado' : 'planos criados'}
                </p>
              </div>
              <Button
                onClick={handleCreatePlan}
                className="bg-green-600 hover:bg-green-600-light text-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </div>

            {/* Lista de planos */}
            {mealPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mb-6">
                  <Flame className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="heading-serif text-xl text-slate-900 mb-2">
                  Nenhum plano criado ainda
                </h3>
                <p className="text-sm text-slate-400 mb-8 max-w-sm text-center">
                  Crie seu primeiro plano alimentar com ajuda da IA para comecar sua jornada
                </p>
                <Button
                  onClick={handleCreatePlan}
                  className="bg-green-600 hover:bg-green-600-light text-white rounded-xl"
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
                    className={`group p-0 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-transparent hover:border-green-600/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    {/* Badge bar */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          plan.created_by === 'ai'
                            ? 'bg-green-50 text-green-600'
                            : 'bg-slate-900/10 text-slate-900'
                        }`}
                      >
                        {plan.created_by === 'ai' ? (
                          <><Sparkles className="w-3 h-3" /> IA</>
                        ) : (
                          <><UserPen className="w-3 h-3" /> Manual</>
                        )}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={(e) => handleDownloadPdf(plan.id, plan.plan_name, e)}
                          className="p-1.5 rounded-lg text-slate-900/20 hover:text-green-600 hover:bg-green-600/5 transition-all duration-200"
                          title="Baixar PDF"
                        >
                          {downloadingPdf === plan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                          ) : (
                            <FileDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlan(plan.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-900/20 hover:text-red-600 hover:bg-red-600/5 transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                      <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">
                        {plan.plan_name}
                      </h3>
                      {plan.description && (
                        <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                          {plan.description}
                        </p>
                      )}
                    </div>

                    {/* Macros grid */}
                    <div className="grid grid-cols-4 gap-0 border-t border-gray-200">
                      <div className="p-3 text-center border-r border-gray-200">
                        <Flame className="w-3.5 h-3.5 text-orange-600 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-900">{plan.daily_calories}</p>
                        <p className="text-[10px] text-slate-400">kcal</p>
                      </div>
                      <div className="p-3 text-center border-r border-gray-200">
                        <Beef className="w-3.5 h-3.5 text-red-600 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-900">{plan.daily_protein_g}g</p>
                        <p className="text-[10px] text-slate-400">prot</p>
                      </div>
                      <div className="p-3 text-center border-r border-gray-200">
                        <Wheat className="w-3.5 h-3.5 text-orange-600 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-900">{plan.daily_carbs_g}g</p>
                        <p className="text-[10px] text-slate-400">carb</p>
                      </div>
                      <div className="p-3 text-center">
                        <Droplets className="w-3.5 h-3.5 text-green-600 mx-auto mb-1" />
                        <p className="text-xs font-semibold text-slate-900">{plan.daily_fat_g}g</p>
                        <p className="text-[10px] text-slate-400">gord</p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 bg-gray-50/50 flex items-center text-[11px] text-slate-400">
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
                      ? 'bg-green-50 text-green-600'
                      : 'bg-slate-900/10 text-slate-900'
                  }`}
                >
                  {selectedPlan.created_by === 'ai' ? (
                    <><Sparkles className="w-3 h-3" /> Criado por IA</>
                  ) : (
                    <><UserPen className="w-3 h-3" /> Criado manualmente</>
                  )}
                </span>
                <h2 className="heading-serif text-2xl text-slate-900">
                  {selectedPlan.plan_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {selectedPlan.description && (
              <p className="px-6 pb-4 text-sm text-slate-500 leading-relaxed">
                {selectedPlan.description}
              </p>
            )}

            {/* Macros detalhados */}
            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl">
                <Flame className="w-5 h-5 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedPlan.daily_calories}</p>
                <p className="text-xs text-slate-400">kcal / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-red-600/10 to-red-600/5 rounded-2xl">
                <Beef className="w-5 h-5 text-red-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedPlan.daily_protein_g}g</p>
                <p className="text-xs text-slate-400">Proteina / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl">
                <Wheat className="w-5 h-5 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedPlan.daily_carbs_g}g</p>
                <p className="text-xs text-slate-400">Carboidratos / dia</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 rounded-2xl">
                <Droplets className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedPlan.daily_fat_g}g</p>
                <p className="text-xs text-slate-400">Gordura / dia</p>
              </div>
            </div>

            {/* Acoes */}
            <div className="flex gap-3 p-6 pt-0">
              <Button
                onClick={() => handleDownloadPdf(selectedPlan.id, selectedPlan.plan_name)}
                disabled={downloadingPdf === selectedPlan.id}
                variant="outline"
                className="flex-1 rounded-xl border-gray-200 hover:border-green-600/30 disabled:opacity-60"
              >
                {downloadingPdf === selectedPlan.id ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                {downloadingPdf === selectedPlan.id ? 'Gerando...' : 'Baixar PDF'}
              </Button>
              <Button
                onClick={() => {
                  router.push(`/chat?prompt=${encodeURIComponent(`Edite o plano ${selectedPlan.plan_name}`)}`);
                }}
                className="flex-1 bg-green-600 hover:bg-green-600-light text-white rounded-xl"
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar com IA
              </Button>
            </div>

            {/* Date footer */}
            <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-200 flex items-center text-xs text-slate-400">
              <Calendar className="w-3 h-3 mr-1.5" />
              Criado em {new Date(selectedPlan.created_at).toLocaleDateString('pt-BR')}
            </div>
          </Card>
        </div>
      )}

      {/* PDF toast */}
      {pdfToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium animate-slide-up ${
          pdfToast.type === 'success'
            ? 'bg-green-600 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {pdfToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {pdfToast.message}
        </div>
      )}
    </div>
  );
}
