'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Play, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface EvalRun {
  id: string;
  question: string;
  answer: string | null;
  expected_answer: string | null;
  model_answer: string | null;
  latency_ms: number | null;
  result: {
    faithfulness: number | null;
    answer_relevancy: number | null;
    context_recall: number | null;
    context_precision: number | null;
    overall_score: number | null;
  } | null;
}

interface EvalExperiment {
  id: string;
  name: string;
  description: string | null;
  params: {
    prompt: string;
    retrieval_source: string;
    dataset_filename: string;
  } | null;
  created_at: string;
  run_count: number;
  runs?: EvalRun[];
}

const RETRIEVAL_SOURCES = ['json', 'pdf', 'md'];

export default function EvalPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [datasets, setDatasets] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<EvalExperiment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, EvalRun[]>>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    prompt: '',
    retrieval_source: 'json',
    dataset_filename: 'golden_dataset.json',
    agent_mode: 'direct',
  });

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  useEffect(() => {
    fetchDatasets();
    fetchExperiments();
  }, []);

  async function fetchDatasets() {
    const res = await fetch('/api/eval/datasets');
    const data = await res.json();
    setDatasets(data);
  }

  async function fetchExperiments() {
    const res = await fetch('/api/eval/experiments');
    const data = await res.json();
    setExperiments(data.experiments || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.prompt) return;
    setLoading(true);
    try {
      const res = await fetch('/api/eval/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setForm({ name: '', description: '', prompt: '', retrieval_source: 'json', dataset_filename: 'golden_dataset.json', agent_mode: 'direct' });
        await fetchExperiments();
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!expandedRuns[id]) {
      const res = await fetch(`/api/eval/experiments/${id}`);
      const data = await res.json();
      setExpandedRuns(prev => ({ ...prev, [id]: data.runs || [] }));
    }
  }

  async function runExperiment(id: string) {
    setRunning(id);
    try {
      const res = await fetch(`/api/eval/experiments/${id}`, { method: 'POST' });
      if (res.ok) {
        const runs = await res.json();
        setExpandedRuns(prev => ({ ...prev, [id]: runs }));
        setExpandedId(id);
        await fetchExperiments();
      }
    } finally {
      setRunning(null);
    }
  }

  function scoreColor(score: number | null) {
    if (score === null) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-500';
  }

  if (isPending) return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Eval Lab" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Form */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <FlaskConical className="w-5 h-5 text-nutria-verde" />
              <h2 className="font-semibold text-lg">Novo Experimento</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    placeholder="Ex: Prompt v2 restritivo"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    placeholder="Opcional"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Prompt</label>
                <Textarea
                  placeholder="Você é um assistente nutricional. Use APENAS o contexto fornecido..."
                  value={form.prompt}
                  onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
                  className="min-h-[140px] font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Dataset</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.dataset_filename}
                    onChange={e => setForm(p => ({ ...p, dataset_filename: e.target.value }))}
                  >
                    {datasets.length === 0 && (
                      <option value="golden_dataset.json">golden_dataset.json</option>
                    )}
                    {datasets.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Retrieval Source</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.retrieval_source}
                    onChange={e => setForm(p => ({ ...p, retrieval_source: e.target.value }))}
                  >
                    {RETRIEVAL_SOURCES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Agent</label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.agent_mode}
                    onChange={e => setForm(p => ({ ...p, agent_mode: e.target.value }))}
                  >
                    <option value="direct">direct — sem tools</option>
                    <option value="production">production — agent atual</option>
                    <option value="test">test — agent customizado</option>
                  </select>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="gap-2">
                <Play className="w-4 h-4" />
                {loading ? 'Criando...' : 'Criar Experimento'}
              </Button>
            </form>
          </Card>

          {/* Experiments list */}
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Experimentos</h2>
            {experiments.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum experimento ainda.</p>
            )}
            {experiments.map(exp => (
              <Card key={exp.id} className="overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
                  <button
                    onClick={() => toggleExpand(exp.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div>
                      <p className="font-medium">{exp.name}</p>
                      {exp.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{exp.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">{exp.params?.dataset_filename}</Badge>
                      <Badge variant="outline">{exp.params?.retrieval_source}</Badge>
                      <Badge variant={exp.params?.agent_mode === 'production' ? 'default' : exp.params?.agent_mode === 'test' ? 'secondary' : 'outline'}>
                        {exp.params?.agent_mode ?? 'direct'}
                      </Badge>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(exp.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <span>{exp.run_count} runs</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 px-2.5 text-xs"
                      disabled={running === exp.id}
                      onClick={() => runExperiment(exp.id)}
                    >
                      {running === exp.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Play className="w-3 h-3" />}
                      {running === exp.id ? 'Rodando...' : 'Rodar'}
                    </Button>
                    <button onClick={() => toggleExpand(exp.id)}>
                      {expandedId === exp.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === exp.id && (
                  <div className="border-t">
                    {/* Prompt preview */}
                    <div className="px-5 py-3 bg-muted/30 border-b">
                      <p className="text-xs font-medium text-muted-foreground mb-1">PROMPT</p>
                      <p className="text-xs font-mono whitespace-pre-wrap line-clamp-3">
                        {exp.params?.prompt}
                      </p>
                    </div>

                    {/* Runs */}
                    <div className="divide-y">
                      {(expandedRuns[exp.id] || []).length === 0 && (
                        <p className="px-5 py-4 text-sm text-muted-foreground">Sem runs ainda.</p>
                      )}
                      {(expandedRuns[exp.id] || []).map((run, i) => (
                        <div key={run.id} className="px-5 py-4 space-y-2">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium">
                              <span className="text-muted-foreground mr-2">#{i + 1}</span>
                              {run.question}
                            </p>
                            {run.latency_ms && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {run.latency_ms}ms
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {run.expected_answer && (
                              <div className="space-y-1">
                                <p className="font-medium flex items-center gap-1 text-muted-foreground">
                                  <CheckCircle2 className="w-3 h-3" /> Esperado
                                </p>
                                <p className="bg-green-50 border border-green-100 rounded p-2 text-green-800">
                                  {run.expected_answer}
                                </p>
                              </div>
                            )}
                            {run.answer && (
                              <div className="space-y-1">
                                <p className="font-medium flex items-center gap-1 text-muted-foreground">
                                  <XCircle className="w-3 h-3" /> Resposta do Model
                                </p>
                                <p className="bg-blue-50 border border-blue-100 rounded p-2 text-blue-800">
                                  {run.answer}
                                </p>
                              </div>
                            )}
                          </div>

                          {run.result && (
                            <div className="flex gap-4 text-xs pt-1">
                              {[
                                ['Faithfulness', run.result.faithfulness],
                                ['Relevancy', run.result.answer_relevancy],
                                ['Recall', run.result.context_recall],
                                ['Precision', run.result.context_precision],
                                ['Score', run.result.overall_score],
                              ].map(([label, value]) => (
                                <div key={label as string} className="text-center">
                                  <p className="text-muted-foreground">{label}</p>
                                  <p className={`font-semibold ${scoreColor(value as number | null)}`}>
                                    {value !== null ? (value as number).toFixed(2) : '—'}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
