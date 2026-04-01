'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Leaf, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const STEPS = ['Pessoal', 'Objetivo', 'Restricoes'];

const activityOptions = [
  { value: 'sedentary', label: 'Sedentario', desc: 'Pouco ou nenhum exercicio' },
  { value: 'light', label: 'Levemente ativo', desc: '1-3 dias/semana' },
  { value: 'moderate', label: 'Moderado', desc: '3-5 dias/semana' },
  { value: 'active', label: 'Ativo', desc: '6-7 dias/semana' },
  { value: 'very_active', label: 'Muito ativo', desc: 'Atleta ou trabalho fisico' },
];

const goalOptions = [
  { value: 'weight_loss', label: 'Perder peso', desc: 'Deficit calorico moderado' },
  { value: 'maintain', label: 'Manter peso', desc: 'Equilibrio calorico' },
  { value: 'weight_gain', label: 'Ganhar massa', desc: 'Superavit calorico' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const authFetch = useAuthFetch();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 0 — personal
  const [name, setName] = useState(session?.user?.name ?? '');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'non_binary'>('male');

  // Step 1 — goal
  const [goal, setGoal] = useState('maintain');
  const [activity, setActivity] = useState('moderate');

  // Step 2 — restrictions
  const [restrictions, setRestrictions] = useState('');
  const [allergies, setAllergies] = useState('');
  const [dislikes, setDislikes] = useState('');

  // Load existing profile data
  useEffect(() => {
    if (!session) return;
    authFetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.name) setName(data.name);
        if (data.age) setAge(String(data.age));
        if (data.weight_kg) setWeight(String(data.weight_kg));
        if (data.height_cm) setHeight(String(data.height_cm));
        if (data.gender) setGender(data.gender);
        if (data.diet_goal) setGoal(data.diet_goal);
        if (data.activity_level) setActivity(data.activity_level);
        if (data.dietary_restrictions?.length) setRestrictions(data.dietary_restrictions.join(', '));
        if (data.allergies?.length) setAllergies(data.allergies.join(', '));
        if (data.disliked_foods?.length) setDislikes(data.disliked_foods.join(', '));
      })
      .catch(() => {});
  }, [session]);

  const toList = (s: string) =>
    s.split(',').map((x) => x.trim()).filter(Boolean);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || session?.user?.name,
          age: age ? parseInt(age) : undefined,
          weight_kg: weight ? parseFloat(weight) : undefined,
          height_cm: height ? parseFloat(height) : undefined,
          gender,
          activity_level: activity,
          diet_goal: goal,
          dietary_restrictions: toList(restrictions),
          allergies: toList(allergies),
          disliked_foods: toList(dislikes),
          preferred_cuisines: [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Erro ao salvar perfil');
      }

      router.push('/chat');
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-nutria-creme grain flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-nutria-verde/20 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-nutria-verde" />
          </div>
          <span className="heading-serif text-2xl text-nutria-bordo">nutri.a</span>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-nutria-verde' : 'bg-nutria-creme-dark'}`} />
              <p className={`text-xs mt-1.5 ${i === step ? 'text-nutria-verde font-medium' : 'text-nutria-bordo/40'}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm border border-nutria-creme-dark">
          {/* Step 0 */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="heading-serif text-2xl text-nutria-bordo">Informacoes pessoais</h2>
              <div>
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Idade</Label>
                  <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" className="mt-1.5" />
                </div>
                <div>
                  <Label>Sexo</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="mt-1.5 w-full h-10 px-3 rounded-xl border border-nutria-creme-dark bg-white text-sm text-nutria-bordo"
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                    <option value="non_binary">Nao binario</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Peso (kg)</Label>
                  <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" className="mt-1.5" />
                </div>
                <div>
                  <Label>Altura (cm)</Label>
                  <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" className="mt-1.5" />
                </div>
              </div>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="heading-serif text-2xl text-nutria-bordo">Seu objetivo</h2>
              <div className="space-y-2">
                {goalOptions.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => setGoal(g.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      goal === g.value
                        ? 'border-nutria-verde bg-nutria-verde/5'
                        : 'border-nutria-creme-dark hover:border-nutria-verde/30'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${goal === g.value ? 'border-nutria-verde bg-nutria-verde' : 'border-nutria-bordo/30'}`}>
                      {goal === g.value && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-nutria-bordo">{g.label}</p>
                      <p className="text-xs text-nutria-bordo/50">{g.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <Label className="mb-3 block">Nivel de atividade</Label>
                <div className="space-y-2">
                  {activityOptions.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setActivity(a.value)}
                      className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-all ${
                        activity === a.value
                          ? 'border-nutria-verde bg-nutria-verde/5'
                          : 'border-nutria-creme-dark hover:border-nutria-verde/30'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${activity === a.value ? 'border-nutria-verde bg-nutria-verde' : 'border-nutria-bordo/30'}`}>
                        {activity === a.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-nutria-bordo">{a.label}</p>
                        <p className="text-[11px] text-nutria-bordo/50">{a.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="heading-serif text-2xl text-nutria-bordo">Restricoes alimentares</h2>
              <p className="text-sm text-nutria-bordo/50">Separe por virgula. Deixe em branco se nao houver.</p>
              <div>
                <Label>Restricoes dieteticas</Label>
                <Input value={restrictions} onChange={(e) => setRestrictions(e.target.value)} placeholder="vegetariano, sem gluten..." className="mt-1.5" />
              </div>
              <div>
                <Label>Alergias</Label>
                <Input value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="amendoim, lactose, frutos do mar..." className="mt-1.5" />
              </div>
              <div>
                <Label>Alimentos que nao gosta</Label>
                <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="brocolis, figado..." className="mt-1.5" />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 rounded-xl">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} className="flex-1 bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl">
                Proximo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-nutria-verde hover:bg-nutria-verde-light text-white rounded-xl">
                {loading ? 'Salvando...' : 'Concluir'}
                {!loading && <Check className="w-4 h-4 ml-2" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
