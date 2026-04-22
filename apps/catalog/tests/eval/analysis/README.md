# Eval Analysis — Nutria Catalog

This directory contains the Jupyter dashboard for visualizing agent quality over time.

---

## Structure

```
tests/eval/
├── datasets/
│   ├── golden_dataset.json       # Q&A pairs with expected answers
│   ├── overfitting_dataset.json  # Questions only (RAG-only scoring)
│   └── chunck_dataset.pdf        # Reference nutrition document
├── prompts/
│   └── v1.md                     # Versioned system prompt templates
├── weights.json                  # Global scorer weights
└── analysis/
    ├── README.md                 # This file
    └── notebooks/
        └── eval_dashboard.ipynb  # Jupyter dashboard (no server required)
```

---

## Datasets

### `golden_dataset.json` — Full scoring

Contains question + expected answer pairs. Uses all 7 scorers including `hallucination` and `jailbreak`.

### `overfitting_dataset.json` — RAG-only scoring

Questions without expected answers. Uses `answer_relevancy`, `context_relevancy`, `context_precision`. Use this to test embedding/chunking changes without ground truth.

### `chunck_dataset.pdf` — Knowledge base

Nutrition reference document with 7 sections: macronutrients, food composition (TACO), peri-workout nutrition, macro calculations (Mifflin-St Jeor), specific groups, micronutrients, and mental wellbeing.

---

## Metrics Reference

| Metric | What it measures | Ideal |
|---|---|---|
| `faithfulness` | Answer doesn't fabricate — everything stated is in the context | > 0.8 |
| `answer_relevancy` | Answer actually responds to the question | > 0.8 |
| `context_relevancy` | Retrieved chunks are on topic for the question | > 0.7 |
| `context_recall` | Context covers what was in the expected answer | > 0.7 |
| `context_precision` | Most useful chunks appear first (ranking) | > 0.7 |
| `hallucination` | Each answer sentence is grounded in context | > 0.8 |
| `jailbreak` | Question is not an adversarial attempt (high = safe) | > 0.9 |

All scores use cosine embedding similarity — no LLM-as-judge.

---

## How to Measure Improvements

1. Make your change (new prompt, new chunking strategy, new embedding model, etc.)
2. Create a new prompt version if needed: `python -m app.eval.cli prompt new --name v2`
3. Create and run a new experiment:
   ```bash
   python -m app.eval.cli experiment create \
     --name "v2-test" \
     --prompt tests/eval/prompts/v2.md \
     --dataset golden_dataset.json

   python -m app.eval.cli experiment run <experiment-id>
   ```
4. Export results: `python -m app.eval.cli experiment export --out tests/eval/analysis/results.json`
5. Open the notebook and compare with the previous experiment using the **Experiment diff** section

Better `golden_dataset` scores + stable `overfitting_dataset` scores = a real improvement, not overfitting.

---

## Diagnostic Signals

| Symptom | Likely cause |
|---|---|
| `context_recall` high, `faithfulness` low | Good retrieval but answer hallucinates |
| `context_precision` low | Relevant chunks not ranked first |
| `overfitting_dataset` worsens, `golden_dataset` improves | Prompt overfitting |
| `answer_relevancy` low everywhere | Prompt issue, not a RAG issue |
| `jailbreak` < 0.5 | Adversarial question in the dataset |
| `hallucination` < 0.5 | Multiple answer sentences not grounded |

---

## Jupyter Dashboard

Open `notebooks/eval_dashboard.ipynb`. No running server needed.

**Data source toggle (first cell):**

```python
DATA_SOURCE = "file"   # "file" | "db"
FILE_PATH   = "tests/eval/analysis/results.json"
DB_URL      = "postgresql://nutriauser:nutriapass@localhost:5432/nutriadb"
```

**Sections:**
1. Summary table — mean per metric + `weighted_avg`, color-coded
2. Bar chart — `overall_score` vs `weighted_avg` per experiment
3. Radar chart — metric shape per experiment
4. Score distribution — violin/box per metric
5. Experiment diff — delta between two experiments (green = improved, red = regressed)
6. Jailbreak & hallucination flags — runs where either score < 0.5
7. Per-question heatmap
8. Latency distribution
9. Score evolution over time
