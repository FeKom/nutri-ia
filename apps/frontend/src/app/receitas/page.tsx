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
  UtensilsCrossed,
  Clock,
  ChefHat,
  Search,
  Flame,
  Beef,
  Wheat,
  Droplets,
  X,
  Sparkles,
  Plus,
} from 'lucide-react';

interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'cafe-da-manha' | 'almoco' | 'jantar' | 'lanche';
  prep_time_minutes: number;
  difficulty: 'facil' | 'medio' | 'dificil';
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

const categoryLabels: Record<string, string> = {
  'cafe-da-manha': 'Cafe da Manha',
  almoco: 'Almoco',
  jantar: 'Jantar',
  lanche: 'Lanche',
};

const difficultyLabels: Record<string, string> = {
  facil: 'Facil',
  medio: 'Medio',
  dificil: 'Dificil',
};


const filterTabs = [
  { key: 'todas', label: 'Todas' },
  { key: 'cafe-da-manha', label: 'Cafe da Manha' },
  { key: 'almoco', label: 'Almoco' },
  { key: 'jantar', label: 'Jantar' },
  { key: 'lanche', label: 'Lanche' },
];

export default function ReceitasPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const authFetch = useAuthFetch();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('todas');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState<Recipe['category']>('almoco');
  const [newDifficulty, setNewDifficulty] = useState<Recipe['difficulty']>('facil');
  const [newPrepTime, setNewPrepTime] = useState('');
  const [newCalories, setNewCalories] = useState('');
  const [newProtein, setNewProtein] = useState('');
  const [newCarbs, setNewCarbs] = useState('');
  const [newFat, setNewFat] = useState('');
  const [newIngredients, setNewIngredients] = useState('');
  const [newInstructions, setNewInstructions] = useState('');

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    setLoadingRecipes(true);
    authFetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 50 }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setRecipes(data.recipes ?? []))
      .catch(() => setRecipes([]))
      .finally(() => setLoadingRecipes(false));
  }, [session]);

  const handleCreateRecipe = async () => {
    if (!newName || !newPrepTime || !newCalories) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/recipes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          category: newCategory,
          difficulty: newDifficulty,
          prep_time_minutes: parseInt(newPrepTime),
          calories: parseInt(newCalories),
          protein_g: parseFloat(newProtein) || 0,
          carbs_g: parseFloat(newCarbs) || 0,
          fat_g: parseFloat(newFat) || 0,
          ingredients: newIngredients.split('\n').map((s) => s.trim()).filter(Boolean),
          instructions: newInstructions || undefined,
        }),
      });
      if (res.ok) {
        const created: Recipe = await res.json();
        setRecipes((prev) => [created, ...prev]);
        setShowCreateForm(false);
        setNewName(''); setNewDescription(''); setNewPrepTime('');
        setNewCalories(''); setNewProtein(''); setNewCarbs('');
        setNewFat(''); setNewIngredients(''); setNewInstructions('');
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = recipes.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeFilter === 'todas' || r.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-green-600 animate-pulse-soft" />
          </div>
          <p className="text-sm text-slate-400">Carregando receitas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Receitas" subtitle="Descubra receitas saudaveis e nutritivas" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Header row */}
            <div className="flex items-center justify-between mb-6 animate-slide-up">
              <div />
              <Button
                onClick={() => setShowCreateForm(true)}
                className="bg-green-600 hover:bg-green-600-light text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova Receita
              </Button>
            </div>

          {/* Search + filters */}
            <div className="mb-8 animate-slide-up">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar receitas..."
                  className="pl-10 h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeFilter === tab.key
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'bg-white text-slate-500 hover:bg-gray-100 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipe grid */}
            {loadingRecipes ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mb-6">
                  <UtensilsCrossed className="w-10 h-10 text-green-600 animate-pulse" />
                </div>
                <p className="text-sm text-slate-400">Carregando receitas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-green-50 flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="heading-serif text-xl text-slate-900 mb-2">
                  Nenhuma receita encontrada
                </h3>
                <p className="text-sm text-slate-400">
                  Tente buscar com outros termos ou filtros
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((recipe, index) => (
                  <Card
                    key={recipe.id}
                    className={`group p-0 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-transparent hover:border-green-600/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    {/* Category badge */}
                    <div className="px-5 pt-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600">
                        {categoryLabels[recipe.category]}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                      <h3 className="font-semibold text-slate-900 mb-1.5">
                        {recipe.name}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                        {recipe.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {recipe.prep_time_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <ChefHat className="w-3.5 h-3.5" />
                          {difficultyLabels[recipe.difficulty]}
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          {recipe.calories} kcal
                        </span>
                      </div>
                    </div>

                    {/* Macros bar */}
                    <div className="grid grid-cols-3 gap-0 border-t border-gray-200">
                      <div className="p-3 text-center border-r border-gray-200">
                        <p className="text-xs font-semibold text-slate-900">{recipe.protein_g}g</p>
                        <p className="text-[10px] text-slate-400">prot</p>
                      </div>
                      <div className="p-3 text-center border-r border-gray-200">
                        <p className="text-xs font-semibold text-slate-900">{recipe.carbs_g}g</p>
                        <p className="text-[10px] text-slate-400">carb</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-xs font-semibold text-slate-900">{recipe.fat_g}g</p>
                        <p className="text-[10px] text-slate-400">gord</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedRecipe && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setSelectedRecipe(null)}
        >
          <Card
            className="max-w-lg w-full p-0 overflow-hidden shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex-1">
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600 mb-3">
                  {categoryLabels[selectedRecipe.category]}
                </span>
                <h2 className="heading-serif text-2xl text-slate-900">
                  {selectedRecipe.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="px-6 pb-4 text-sm text-slate-500 leading-relaxed">
              {selectedRecipe.description}
            </p>

            {/* Info badges */}
            <div className="flex gap-3 px-6 pb-4">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-slate-900/70">
                <Clock className="w-3.5 h-3.5" />
                {selectedRecipe.prep_time_minutes} min
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs text-slate-900/70">
                <ChefHat className="w-3.5 h-3.5" />
                {difficultyLabels[selectedRecipe.difficulty]}
              </span>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-2 gap-3 px-6 pb-4">
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl">
                <Flame className="w-5 h-5 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedRecipe.calories}</p>
                <p className="text-xs text-slate-400">kcal</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-red-600/10 to-red-600/5 rounded-2xl">
                <Beef className="w-5 h-5 text-red-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedRecipe.protein_g}g</p>
                <p className="text-xs text-slate-400">Proteina</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 rounded-2xl">
                <Wheat className="w-5 h-5 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedRecipe.carbs_g}g</p>
                <p className="text-xs text-slate-400">Carboidratos</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-600/10 to-green-600/5 rounded-2xl">
                <Droplets className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-2xl font-bold text-slate-900">{selectedRecipe.fat_g}g</p>
                <p className="text-xs text-slate-400">Gordura</p>
              </div>
            </div>

            {/* Ingredients */}
            <div className="px-6 pb-4">
              <h3 className="font-semibold text-slate-900 mb-3">Ingredientes</h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-900/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action */}
            <div className="p-6 pt-2">
              <Button
                onClick={() => {
                  router.push(`/chat?prompt=${encodeURIComponent(`Me de a receita completa de ${selectedRecipe.name} com modo de preparo detalhado`)}`);
                }}
                className="w-full bg-green-600 hover:bg-green-600-light text-white rounded-xl"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Pedir receita detalhada com IA
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create recipe modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in"
          onClick={() => setShowCreateForm(false)}
        >
          <Card
            className="max-w-lg w-full p-0 overflow-hidden shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
              <h2 className="heading-serif text-xl text-slate-900">Nova Receita</h2>
              <button onClick={() => setShowCreateForm(false)} className="p-2 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Frango grelhado com batata doce" className="mt-1" />
              </div>
              <div>
                <Label>Descricao</Label>
                <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Descricao breve..." className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as Recipe['category'])} className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-slate-900">
                    <option value="cafe-da-manha">Cafe da Manha</option>
                    <option value="almoco">Almoco</option>
                    <option value="jantar">Jantar</option>
                    <option value="lanche">Lanche</option>
                  </select>
                </div>
                <div>
                  <Label>Dificuldade</Label>
                  <select value={newDifficulty} onChange={(e) => setNewDifficulty(e.target.value as Recipe['difficulty'])} className="mt-1 w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm text-slate-900">
                    <option value="facil">Facil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Dificil</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tempo de preparo (min) *</Label>
                  <Input type="number" value={newPrepTime} onChange={(e) => setNewPrepTime(e.target.value)} placeholder="30" className="mt-1" />
                </div>
                <div>
                  <Label>Calorias *</Label>
                  <Input type="number" value={newCalories} onChange={(e) => setNewCalories(e.target.value)} placeholder="450" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Proteina (g)</Label>
                  <Input type="number" value={newProtein} onChange={(e) => setNewProtein(e.target.value)} placeholder="35" className="mt-1" />
                </div>
                <div>
                  <Label>Carbos (g)</Label>
                  <Input type="number" value={newCarbs} onChange={(e) => setNewCarbs(e.target.value)} placeholder="40" className="mt-1" />
                </div>
                <div>
                  <Label>Gordura (g)</Label>
                  <Input type="number" value={newFat} onChange={(e) => setNewFat(e.target.value)} placeholder="12" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Ingredientes (um por linha)</Label>
                <textarea
                  value={newIngredients}
                  onChange={(e) => setNewIngredients(e.target.value)}
                  placeholder={"200g peito de frango\n150g batata doce\nAzeite a gosto"}
                  rows={4}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-slate-900 resize-none focus:outline-none focus:border-green-600"
                />
              </div>
            </div>

            <div className="p-6 pt-0">
              <Button
                onClick={handleCreateRecipe}
                disabled={saving || !newName || !newPrepTime || !newCalories}
                className="w-full bg-green-600 hover:bg-green-600-light text-white rounded-xl"
              >
                {saving ? 'Salvando...' : 'Salvar Receita'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
