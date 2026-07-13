"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthFetch } from "@/lib/use-auth-fetch";
import { useSession, signOut } from "@/lib/auth-client";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { User, LogOut, Save, Shield, CheckCircle } from "lucide-react";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const authFetch = useAuthFetch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [dietGoal, setDietGoal] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session?.user) return;
    setName(session.user.name || "");
    setEmail(session.user.username || "");

    // age, weight, etc. aren't in the JWT — load them from the profile
    authFetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setName(p.name ?? session.user.name ?? "");
        setAge(p.age?.toString() ?? "");
        setWeight(p.weight_kg?.toString() ?? "");
        setHeight(p.height_cm?.toString() ?? "");
        setGender(p.gender ?? "");
        setActivityLevel(p.activity_level ?? "");
        setDietGoal(p.diet_goal ?? "");
      })
      .catch(() => {});
    // authFetch is intentionally omitted: it's re-created every render (updateToken
    // isn't memoized), so including it would refetch on each keystroke and wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const body = {
        name: name || session?.user.name,
        age: age ? Number(age) : undefined,
        weight_kg: weight ? Number(weight) : undefined,
        height_cm: height ? Number(height) : undefined,
        gender: gender || undefined,
        activity_level: activityLevel || undefined,
        diet_goal: dietGoal || undefined,
      };
      const res = await authFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setMessage("Perfil atualizado com sucesso!");
      } else {
        setMessage("Erro ao atualizar perfil, tente novamente!");
      }
    } catch {
      setMessage("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (isPending) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl space-y-3 p-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
        <p className="text-sm text-slate-400 animate-fade-in">Carregando...</p>
      </div>
    );
  }

  if (!session) return handleLogout();

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <Header
          title="Configuracoes"
          subtitle="Gerencie seu perfil e preferencias"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Perfil */}
            <Card className="p-0 overflow-hidden animate-slide-up">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/30">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Meu Perfil</h2>
              </div>

              <div className="p-6 space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4 pb-5 border-b border-gray-200">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center shadow-sm">
                    <span className="text-2xl font-bold text-white">
                      {name?.charAt(0).toUpperCase() || "U"}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {name || "Usuario"}
                    </p>
                    <p className="text-sm text-slate-400">{email}</p>
                  </div>
                </div>

                {/* Campos */}
                <Field label="Nome" htmlFor="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                  />
                </Field>

                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    className="h-11 bg-gray-50/50 border-gray-200 rounded-xl cursor-not-allowed"
                  />
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Idade" htmlFor="age">
                    <Input
                      id="age"
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="30"
                      className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                    />
                  </Field>
                  <Field label="Peso (kg)" htmlFor="weight">
                    <Input
                      id="weight"
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="72"
                      className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                    />
                  </Field>
                  <Field label="Altura (cm)" htmlFor="height">
                    <Input
                      id="height"
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="175"
                      className="h-11 bg-white border-gray-200 focus:border-green-600 rounded-xl"
                    />
                  </Field>
                </div>

                <Field label="Genero" htmlFor="gender">
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-slate-900 focus:border-green-600 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                    <option value="non_binary">Nao-binario</option>
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nivel de atividade" htmlFor="activity">
                    <select
                      id="activity"
                      value={activityLevel}
                      onChange={(e) => setActivityLevel(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-slate-900 focus:border-green-600 focus:outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="sedentary">Sedentario</option>
                      <option value="light">Leve</option>
                      <option value="moderate">Moderado</option>
                      <option value="active">Ativo</option>
                      <option value="very_active">Muito ativo</option>
                    </select>
                  </Field>
                  <Field label="Objetivo" htmlFor="goal">
                    <select
                      id="goal"
                      value={dietGoal}
                      onChange={(e) => setDietGoal(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm text-slate-900 focus:border-green-600 focus:outline-none"
                    >
                      <option value="">Selecione...</option>
                      <option value="weight_loss">Perder peso</option>
                      <option value="weight_gain">Ganhar peso</option>
                      <option value="maintain">Manter</option>
                    </select>
                  </Field>
                </div>

                {/* Mensagem de feedback */}
                {message && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-sm animate-scale-in ${
                      message.includes("sucesso")
                        ? "bg-green-50 text-green-600"
                        : "bg-red-600/10 text-red-600"
                    }`}
                  >
                    {message.includes("sucesso") && (
                      <CheckCircle className="w-4 h-4 shrink-0" />
                    )}
                    {message}
                  </div>
                )}

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-600-light text-white rounded-xl transition-all duration-200"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Salvando..." : "Salvar Alteracoes"}
                </Button>
              </div>
            </Card>

            {/* Conta */}
            <Card className="p-0 overflow-hidden animate-slide-up stagger-2 opacity-0">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/30">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-orange-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Conta</h2>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Plano atual
                    </p>
                    <p className="text-sm text-slate-400 capitalize mt-0.5">
                      {session.user.planType || "Free"}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-lg">
                    Ativo
                  </div>
                </div>
              </div>
            </Card>

            {/* Sair */}
            <Card className="p-0 overflow-hidden border-red-600/10 animate-slide-up stagger-3 opacity-0">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50/30">
                <div className="w-8 h-8 rounded-lg bg-red-600/10 flex items-center justify-center">
                  <LogOut className="w-4 h-4 text-red-600" />
                </div>
                <h2 className="font-semibold text-slate-900">Sessao</h2>
              </div>

              <div className="p-6">
                <p className="text-sm text-slate-400 mb-4">
                  Encerre sua sessao atual. Voce precisara fazer login
                  novamente.
                </p>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="border-red-600/20 text-red-600 hover:bg-red-600/5 rounded-xl transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da conta
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
