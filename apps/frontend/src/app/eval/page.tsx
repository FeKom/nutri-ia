'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useAuthFetch } from '@/lib/use-auth-fetch';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  FlaskConical, Play, ChevronDown, ChevronUp,
  Clock, CheckCircle2, Loader2, Database,
  Zap, BarChart2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    agent_mode?: string;
  } | null;
  created_at: string;
  run_count: number;
  runs?: EvalRun[];
}

const RETRIEVAL_SOURCES = ['json', 'pdf', 'md'];

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const pct = value !== null ? Math.round(value * 100) : null;
  const color =
    pct === null ? 'bg-gray-200'
    : pct >= 80   ? 'bg-green-500'
    : pct >= 50   ? 'bg-amber-400'
    : 'bg-red-400';
  const textColor =
    pct === null ? 'text-slate-400'
    : pct >= 80   ? 'text-green-700'
    : pct >= 50   ? 'text-amber-700'
    : 'text-red-600';

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        <span className={cn('text-xs font-bold tabular-nums', textColor)}>
          {pct !== null ? `${pct}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: pct !== null ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}

function OverallBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">—</span>;
  const pct = Math.round(score * 100);
  const cls =
    pct >= 80 ? 'bg-green-50 text-green-700 border-green-200'
    : pct >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', cls)}>
      <BarChart2 className="w-3 h-3" />
      {pct}%
    </span>
  );
}

function AgentBadge({ mode }: { mode?: string }) {
  const map: Record<string, string> = {
    production: 'bg-green-50 text-green-700 border-green-200',
    test:       'bg-blue-50 text-blue-700 border-blue-200',
    direct:     'bg-gray-100 text-slate-600 border-gray-200',
  };
  const cls = map[mode ?? 'direct'] ?? map.direct;
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold border', cls)}>
      {mode ?? 'direct'}
    </span>
  );
}

export default function EvalPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const authFetch = useAuthFetch();

  const [datasets, setDatasets] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<EvalExperiment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, EvalRun[]>>({});
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [ingestResults, setIngestResults] = useState<Record<string, { chunks_created: number; chunks_skipped: number }>>({});

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

  async function ingestDataset(filename: string) {
    setIngesting(filename);
    try {
      const res = await fetch(`/api/eval/datasets/${filename}/ingest`, { method: 'POST' });
      const data = await res.json();
      setIngestResults(prev => ({ ...prev, [filename]: data }));
    } finally {
      setIngesting(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.name || !form.prompt) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/eval/experiments', {
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
    if (expandedId === id) { setExpandedId(null); return; }
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
      const res = await authFetch(`/api/eval/experiments/${id}`, { method: 'POST' });
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

  // Avg overall across runs for an experiment
  function avgScore(id: string): number | null {
    const runs = expandedRuns[id];
    if (!runs || runs.length === 0) return null;
    const scores = runs.map(r => r.result?.overall_score).filter((s): s is number => s !== null);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  if (isPending) return null;

  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';
  const selectCls = 'w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:border-green-400 transition-colors';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title="Eval Lab" subtitle="Experimentos de avaliação de qualidade da IA" />

        <main className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Datasets ── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Datasets</h2>
                <p className="text-[11px] text-slate-400">Ingira antes de rodar experimentos</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {datasets.length === 0 && (
                <p className="text-sm text-slate-400 italic">Nenhum dataset encontrado.</p>
              )}
              {datasets.map(d => {
                const result = ingestResults[d];
                return (
                  <div key={d} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <code className="text-xs text-slate-600 font-mono">{d}</code>
                    {result && (
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                        result.chunks_created > 0
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-slate-500'
                      )}>
                        {result.chunks_created > 0 ? `+${result.chunks_created} chunks` : `${result.chunks_skipped} já ingeridos`}
                      </span>
                    )}
                    <button
                      disabled={ingesting === d}
                      onClick={() => ingestDataset(d)}
                      className="flex items-center gap-1 h-6 px-2 rounded-lg bg-white border border-gray-200 text-[10px] font-semibold text-slate-600 hover:border-green-400 hover:text-green-700 disabled:opacity-50 transition-all"
                    >
                      {ingesting === d ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null}
                      {ingesting === d ? 'Ingerindo...' : 'Ingerir'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── New Experiment Form ── */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-sm">Novo Experimento</h2>
                <p className="text-[11px] text-slate-400">Configure e crie um novo experimento de avaliação</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Nome</label>
                  <Input
                    placeholder="Ex: Prompt v2 restritivo"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required
                    className="h-10 rounded-xl border-gray-200 focus:border-green-400 text-slate-800 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className={labelCls}>Descrição <span className="font-normal text-slate-400">(opcional)</span></label>
                  <Input
                    placeholder="Breve descrição do experimento"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className="h-10 rounded-xl border-gray-200 focus:border-green-400 text-slate-800 placeholder:text-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Prompt do sistema</label>
                <Textarea
                  placeholder="Você é um assistente nutricional. Use APENAS o contexto fornecido..."
                  value={form.prompt}
                  onChange={e => setForm(p => ({ ...p, prompt: e.target.value }))}
                  className="min-h-[120px] rounded-xl border-gray-200 focus:border-green-400 font-mono text-sm text-slate-800 placeholder:text-slate-300 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Dataset</label>
                  <select
                    className={selectCls}
                    value={form.dataset_filename}
                    onChange={e => setForm(p => ({ ...p, dataset_filename: e.target.value }))}
                  >
                    {datasets.length === 0 && <option value="golden_dataset.json">golden_dataset.json</option>}
                    {datasets.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Retrieval Source</label>
                  <select
                    className={selectCls}
                    value={form.retrieval_source}
                    onChange={e => setForm(p => ({ ...p, retrieval_source: e.target.value }))}
                  >
                    {RETRIEVAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Modo do agente</label>
                  <select
                    className={selectCls}
                    value={form.agent_mode}
                    onChange={e => setForm(p => ({ ...p, agent_mode: e.target.value }))}
                  >
                    <option value="direct">direct — sem tools</option>
                    <option value="production">production — agent real</option>
                    <option value="test">test — agent customizado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors shadow-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Criando...' : 'Criar Experimento'}
                </button>
                {!form.name && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Nome e prompt são obrigatórios
                  </span>
                )}
              </div>
            </form>
          </section>

          {/* ── Experiments list ── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-sm">
                Experimentos
                {experiments.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-slate-500 text-xs font-normal">
                    {experiments.length}
                  </span>
                )}
              </h2>
            </div>

            {experiments.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <FlaskConical className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">Nenhum experimento ainda. Crie o primeiro acima.</p>
              </div>
            )}

            {experiments.map(exp => {
              const isExpanded = expandedId === exp.id;
              const isRunning = running === exp.id;
              const score = avgScore(exp.id);

              return (
                <div key={exp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Row */}
                  <div className="px-5 py-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <FlaskConical className="w-4 h-4 text-green-600" />
                    </div>

                    {/* Name + meta */}
                    <button
                      onClick={() => toggleExpand(exp.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="font-semibold text-slate-900 text-sm truncate">{exp.name}</p>
                      {exp.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{exp.description}</p>
                      )}
                    </button>

                    {/* Badges */}
                    <div className="hidden md:flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-slate-600 border border-gray-200 font-mono">
                        {exp.params?.dataset_filename?.replace('.json', '')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-slate-600 border border-gray-200">
                        {exp.params?.retrieval_source}
                      </span>
                      <AgentBadge mode={exp.params?.agent_mode} />
                    </div>

                    {/* Score */}
                    <div className="shrink-0">
                      <OverallBadge score={score} />
                    </div>

                    {/* Meta */}
                    <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(exp.created_at).toLocaleDateString('pt-BR')}
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">{exp.run_count} runs</span>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={isRunning}
                        onClick={() => runExperiment(exp.id)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                      >
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        {isRunning ? 'Rodando...' : 'Rodar'}
                      </button>
                      <button
                        onClick={() => toggleExpand(exp.id)}
                        className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-slate-400 hover:bg-gray-50 hover:text-slate-700 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* Prompt preview */}
                      {exp.params?.prompt && (
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Prompt</p>
                          <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap line-clamp-4 leading-relaxed">
                            {exp.params.prompt}
                          </pre>
                        </div>
                      )}

                      {/* Runs */}
                      <div className="divide-y divide-gray-50">
                        {(expandedRuns[exp.id] || []).length === 0 && (
                          <div className="px-5 py-8 text-center">
                            <p className="text-sm text-slate-400">Sem runs ainda. Clique em Rodar para iniciar.</p>
                          </div>
                        )}
                        {(expandedRuns[exp.id] || []).map((run, i) => (
                          <div key={run.id} className="px-5 py-4">
                            {/* Question row */}
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-slate-300 mt-0.5 shrink-0">#{i + 1}</span>
                                <p className="text-sm font-medium text-slate-800 leading-snug">{run.question}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {run.latency_ms && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Zap className="w-2.5 h-2.5" />{run.latency_ms}ms
                                  </span>
                                )}
                                {run.result && <OverallBadge score={run.result.overall_score} />}
                              </div>
                            </div>

                            {/* Score bars */}
                            {run.result && (
                              <div className="flex gap-4 mb-3">
                                <ScoreBar label="Faithfulness" value={run.result.faithfulness} />
                                <ScoreBar label="Relevancy" value={run.result.answer_relevancy} />
                                <ScoreBar label="Recall" value={run.result.context_recall} />
                                <ScoreBar label="Precision" value={run.result.context_precision} />
                              </div>
                            )}

                            {/* Answer comparison */}
                            {(run.expected_answer || run.answer) && (
                              <div className="grid grid-cols-2 gap-3 mt-1">
                                {run.expected_answer && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Esperado
                                    </p>
                                    <p className="text-xs text-slate-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5 leading-relaxed">
                                      {run.expected_answer}
                                    </p>
                                  </div>
                                )}
                                {run.answer && (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                      Resposta do modelo
                                    </p>
                                    <p className="text-xs text-slate-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 leading-relaxed">
                                      {run.answer}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </main>
      </div>
    </div>
  );
}
