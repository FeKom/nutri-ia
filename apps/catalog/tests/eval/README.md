# Eval Framework — Nutria Catalog

The eval system measures the Nutria agent's answer quality over time using embedding-based scoring. It is structured as an internal Python package (`app/eval/`) with a CLI, a plugin scorer system, versioned prompts, and a Jupyter dashboard that requires no running server.

---

## Quick Start

```bash
# From apps/catalog/
cd apps/catalog

# 1. Create an experiment
python -m app.eval.cli experiment create \
  --name "v1-baseline" \
  --prompt tests/eval/prompts/v1.md \
  --dataset golden_dataset.json

# 2. Run it (fetches dataset, calls Mastra, scores, saves to DB)
python -m app.eval.cli experiment run <experiment-id>

# 3. Inspect results
python -m app.eval.cli experiment show <experiment-id>

# 4. Export for the notebook
python -m app.eval.cli experiment export --out tests/eval/analysis/results.json
```

Then open `tests/eval/analysis/notebooks/eval_dashboard.ipynb` and run all cells.

---

## Directory Structure

```
tests/eval/
├── datasets/
│   ├── golden_dataset.json       # Q&A pairs with expected answers — full scoring
│   ├── overfitting_dataset.json  # Questions without expected answers — RAG-only scoring
│   └── chunck_dataset.pdf        # Reference nutrition document (7 sections)
├── prompts/
│   └── v1.md                     # Default system prompt template
├── weights.json                  # Global scorer weights (sum to 1.0)
├── analysis/
│   ├── README.md                 # Analysis workflow guide
│   └── notebooks/
│       └── eval_dashboard.ipynb  # Jupyter dashboard
└── README.md                     # This file
```

---

## CLI Reference

Invoked as `python -m app.eval.cli` (or alias `nutria-eval` if added to Makefile).

### Experiment commands

```bash
# Create a new experiment
python -m app.eval.cli experiment create \
  --name "v2-test" \
  --prompt tests/eval/prompts/v2.md \
  --dataset golden_dataset.json

# Run all questions in an experiment's dataset
python -m app.eval.cli experiment run <experiment-id>

# List all experiments
python -m app.eval.cli experiment list

# Show a single experiment with per-question scores
python -m app.eval.cli experiment show <experiment-id>

# Export results to JSON (for the notebook)
python -m app.eval.cli experiment export --out results.json
```

### Dataset commands

```bash
# List available datasets
python -m app.eval.cli dataset list

# Ingest a dataset file into the vector store (pgvector)
python -m app.eval.cli dataset ingest golden_dataset.json

# Interactive Q&A pair builder
python -m app.eval.cli dataset new --out my_dataset.json
```

### Prompt commands

```bash
# List versioned prompt files
python -m app.eval.cli prompt list

# Create a new prompt file from the template
python -m app.eval.cli prompt new --name v2
```

### Score command (one-shot, no DB)

```bash
python -m app.eval.cli score \
  --question "How much protein does chicken breast have?" \
  --answer "Chicken breast has 31g of protein per 100g." \
  --context "Chicken breast, skinless: 165 kcal, 31g protein, 0g carbs, 3.6g fat per 100g."
```

---

## Scorers

All scorers live in `app/eval/scorers/`. Adding a new scorer = one new file + one line in the registry.

| Scorer | File | What it measures |
|---|---|---|
| `faithfulness` | `embedding.py` | Answer is grounded in the retrieved context |
| `answer_relevancy` | `embedding.py` | Answer actually addresses the question |
| `context_relevancy` | `embedding.py` | Retrieved context is on topic for the question |
| `context_recall` | `embedding.py` | Context covers what was in the expected answer |
| `context_precision` | `embedding.py` | Most useful chunks appear first (ranking quality) |
| `hallucination` | `hallucination.py` | Each answer sentence is grounded in context (sentence-level) |
| `jailbreak` | `jailbreak.py` | Question is not an adversarial/off-topic attempt |

### Interpreting scores

| Metric | Ideal | Alert if |
|---|---|---|
| `faithfulness` | > 0.8 | Low → answer fabricates details not in context |
| `answer_relevancy` | > 0.8 | Low → prompt issue, not a RAG issue |
| `context_relevancy` | > 0.7 | Low → retrieval pulling irrelevant chunks |
| `context_recall` | > 0.7 | Low → context doesn't cover the expected answer |
| `context_precision` | > 0.7 | Low → relevant chunks not ranked first |
| `hallucination` | > 0.8 | Low → individual sentences aren't grounded |
| `jailbreak` | > 0.9 | Low → adversarial question detected |

All scores use **cosine embedding similarity** — no LLM-as-judge.

---

## Weighted Average

Global defaults in `tests/eval/weights.json`:

```json
{
  "faithfulness": 0.25,
  "answer_relevancy": 0.25,
  "context_relevancy": 0.15,
  "context_recall": 0.15,
  "context_precision": 0.10,
  "hallucination": 0.05,
  "jailbreak": 0.05
}
```

`overall_score` in every `EvalResult` is this weighted average, normalized so active scorers always sum to 1.0.

**Per-experiment override** — set `weights` in `experiment.params`:

```json
{ "weights": { "hallucination": 0.30, "faithfulness": 0.40 } }
```

Only the keys you specify are replaced; the rest inherit from `weights.json`. The engine re-normalizes automatically.

---

## Versioned Prompts

System prompts live as Markdown files in `tests/eval/prompts/`. Each version is committed to git, making prompt regressions visible in diffs.

```bash
# Create a new version
python -m app.eval.cli prompt new --name v2
# → creates tests/eval/prompts/v2.md from template

# Reference it when creating an experiment
python -m app.eval.cli experiment create --name "v2-test" --prompt tests/eval/prompts/v2.md ...
```

---

## Diagnosing Problems

| Symptom | Likely cause |
|---|---|
| `context_recall` high, `faithfulness` low | Good retrieval but answer hallucinates |
| `context_precision` low everywhere | Chunking/ranking issue, relevant chunks buried |
| `overfitting_dataset` worsens, `golden_dataset` improves | Prompt overfitting |
| `answer_relevancy` low across all questions | Prompt problem, not RAG |
| `jailbreak` score < 0.5 | Adversarial question in dataset — check the question |
| `hallucination` score < 0.5 | Multiple answer sentences not grounded in context |

---

## Jupyter Dashboard

Open `tests/eval/analysis/notebooks/eval_dashboard.ipynb`. No server required.

**Data source toggle** (first cell):

```python
DATA_SOURCE = "file"   # "file" | "db"
FILE_PATH   = "tests/eval/analysis/results.json"
DB_URL      = "postgresql://nutriauser:nutriapass@localhost:5432/nutriadb"
```

- `"file"` — reads from JSON exported via `experiment export`
- `"db"` — reads directly via SQLAlchemy

**Interactive controls:** experiment selector, metric dropdown, refresh button (ipywidgets).

**Dashboard sections:**
1. Summary table — mean per metric + `weighted_avg`, color-coded
2. Bar chart — `overall_score` vs `weighted_avg` per experiment
3. Radar chart — per-experiment metric shape
4. Score distribution — violin/box per metric (spread, not just mean)
5. Experiment diff — delta table between two experiments (green = improved, red = regressed)
6. Jailbreak & hallucination flags — runs where either score < 0.5
7. Per-question heatmap
8. Latency distribution
9. Score evolution over time
