'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';

interface Recipe {
  id: string;
  name: string;
  description: string;
  category: 'cafe-da-manha' | 'almoco' | 'jantar' | 'lanche';
  prepTime: number;
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

const mockRecipes: Recipe[] = [
  {
    id: '1',
    name: 'Bowl de Acai Proteico',
    description: 'Bowl de acai com whey protein, banana, granola e frutas vermelhas. Rico em antioxidantes e proteina.',
    category: 'cafe-da-manha',
    prepTime: 10,
    difficulty: 'facil',
    calories: 420,
    protein_g: 28,
    carbs_g: 52,
    fat_g: 12,
    ingredients: ['200g polpa de acai', '1 scoop whey protein', '1 banana', '30g granola', '50g frutas vermelhas', 'Mel a gosto'],
  },
  {
    id: '2',
    name: 'Frango Grelhado com Batata Doce',
    description: 'Peito de frango grelhado com batata doce assada e salada verde. Classico do ganho de massa.',
    category: 'almoco',
    prepTime: 35,
    difficulty: 'facil',
    calories: 520,
    protein_g: 42,
    carbs_g: 48,
    fat_g: 14,
    ingredients: ['200g peito de frango', '150g batata doce', 'Azeite de oliva', 'Sal e pimenta', 'Mix de folhas verdes', 'Tomate cereja'],
  },
  {
    id: '3',
    name: 'Salmao com Legumes Assados',
    description: 'File de salmao assado com abobrinha, berinjela e pimentao. Rico em omega 3.',
    category: 'jantar',
    prepTime: 40,
    difficulty: 'medio',
    calories: 480,
    protein_g: 38,
    carbs_g: 22,
    fat_g: 28,
    ingredients: ['180g file de salmao', '1 abobrinha', '1/2 berinjela', '1 pimentao', 'Azeite', 'Ervas finas', 'Limao'],
  },
  {
    id: '4',
    name: 'Wrap Integral de Atum',
    description: 'Wrap integral recheado com atum, cream cheese light, rucula e tomate. Rapido e pratico.',
    category: 'lanche',
    prepTime: 10,
    difficulty: 'facil',
    calories: 320,
    protein_g: 24,
    carbs_g: 30,
    fat_g: 12,
    ingredients: ['1 tortilha integral', '1 lata de atum', '2 col cream cheese light', 'Rucula', 'Tomate', 'Sal e pimenta'],
  },
  {
    id: '5',
    name: 'Omelete de Espinafre e Queijo',
    description: 'Omelete leve com espinafre refogado e queijo cottage. Perfeito para um cafe da manha proteico.',
    category: 'cafe-da-manha',
    prepTime: 15,
    difficulty: 'facil',
    calories: 280,
    protein_g: 22,
    carbs_g: 4,
    fat_g: 20,
    ingredients: ['3 ovos', '1 xicara espinafre', '50g queijo cottage', 'Sal e pimenta', 'Azeite'],
  },
  {
    id: '6',
    name: 'Risoto de Cogumelos e Frango',
    description: 'Risoto cremoso com cogumelos frescos e frango desfiado. Comfort food nutritivo.',
    category: 'jantar',
    prepTime: 50,
    difficulty: 'dificil',
    calories: 580,
    protein_g: 35,
    carbs_g: 62,
    fat_g: 18,
    ingredients: ['200g arroz arborio', '150g cogumelos frescos', '150g frango desfiado', 'Caldo de legumes', 'Cebola', 'Alho', 'Parmesao ralado', 'Manteiga'],
  },
];

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
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('todas');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  const filtered = mockRecipes.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeFilter === 'todas' || r.category === activeFilter;
    return matchesSearch && matchesCategory;
  });

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-nutria-creme">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/10 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-nutria-verde animate-pulse-soft" />
          </div>
          <p className="text-sm text-nutria-bordo/50">Carregando receitas...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="flex h-screen bg-nutria-creme">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header title="Receitas" subtitle="Descubra receitas saudaveis e nutritivas" />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {/* Search + filters */}
            <div className="mb-8 animate-slide-up">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nutria-bordo/30" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar receitas..."
                  className="pl-10 h-11 bg-white border-nutria-creme-dark focus:border-nutria-verde rounded-xl"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      activeFilter === tab.key
                        ? 'bg-nutria-verde text-white shadow-sm'
                        : 'bg-white text-nutria-bordo/60 hover:bg-nutria-creme-dark hover:text-nutria-bordo'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipe grid */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="w-20 h-20 rounded-3xl bg-nutria-verde/10 flex items-center justify-center mb-6">
                  <Search className="w-10 h-10 text-nutria-verde/40" />
                </div>
                <h3 className="heading-serif text-xl text-nutria-bordo mb-2">
                  Nenhuma receita encontrada
                </h3>
                <p className="text-sm text-nutria-bordo/50">
                  Tente buscar com outros termos ou filtros
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((recipe, index) => (
                  <Card
                    key={recipe.id}
                    className={`group p-0 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-transparent hover:border-nutria-verde/20 animate-slide-up opacity-0 stagger-${Math.min(index + 1, 6)}`}
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    {/* Category badge */}
                    <div className="px-5 pt-5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-nutria-verde/10 text-nutria-verde">
                        {categoryLabels[recipe.category]}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="px-5 py-4">
                      <h3 className="font-semibold text-nutria-bordo mb-1.5">
                        {recipe.name}
                      </h3>
                      <p className="text-sm text-nutria-bordo/50 line-clamp-2 mb-4">
                        {recipe.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-nutria-bordo/50">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {recipe.prepTime} min
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
                    <div className="grid grid-cols-3 gap-0 border-t border-nutria-creme-dark">
                      <div className="p-3 text-center border-r border-nutria-creme-dark">
                        <p className="text-xs font-semibold text-nutria-bordo">{recipe.protein_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">prot</p>
                      </div>
                      <div className="p-3 text-center border-r border-nutria-creme-dark">
                        <p className="text-xs font-semibold text-nutria-bordo">{recipe.carbs_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">carb</p>
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-xs font-semibold text-nutria-bordo">{recipe.fat_g}g</p>
                        <p className="text-[10px] text-nutria-bordo/40">gord</p>
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
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-nutria-verde/10 text-nutria-verde mb-3">
                  {categoryLabels[selectedRecipe.category]}
                </span>
                <h2 className="heading-serif text-2xl text-nutria-bordo">
                  {selectedRecipe.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="p-2 rounded-xl hover:bg-nutria-creme-dark transition-colors"
              >
                <X className="w-5 h-5 text-nutria-bordo/40" />
              </button>
            </div>

            <p className="px-6 pb-4 text-sm text-nutria-bordo/60 leading-relaxed">
              {selectedRecipe.description}
            </p>

            {/* Info badges */}
            <div className="flex gap-3 px-6 pb-4">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-nutria-creme-dark rounded-lg text-xs text-nutria-bordo/70">
                <Clock className="w-3.5 h-3.5" />
                {selectedRecipe.prepTime} min
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-nutria-creme-dark rounded-lg text-xs text-nutria-bordo/70">
                <ChefHat className="w-3.5 h-3.5" />
                {difficultyLabels[selectedRecipe.difficulty]}
              </span>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-2 gap-3 px-6 pb-4">
              <div className="p-4 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 rounded-2xl">
                <Flame className="w-5 h-5 text-nutria-laranja mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedRecipe.calories}</p>
                <p className="text-xs text-nutria-bordo/50">kcal</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-vermelho/10 to-nutria-vermelho/5 rounded-2xl">
                <Beef className="w-5 h-5 text-nutria-vermelho mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedRecipe.protein_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Proteina</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-laranja/10 to-nutria-laranja/5 rounded-2xl">
                <Wheat className="w-5 h-5 text-nutria-laranja mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedRecipe.carbs_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Carboidratos</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-nutria-verde/10 to-nutria-verde/5 rounded-2xl">
                <Droplets className="w-5 h-5 text-nutria-verde mb-2" />
                <p className="text-2xl font-bold text-nutria-bordo">{selectedRecipe.fat_g}g</p>
                <p className="text-xs text-nutria-bordo/50">Gordura</p>
              </div>
            </div>

            {/* Ingredients */}
            <div className="px-6 pb-4">
              <h3 className="font-semibold text-nutria-bordo mb-3">Ingredientes</h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-nutria-bordo/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-nutria-verde shrink-0" />
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
                className="w-full bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Pedir receita detalhada com IA
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
