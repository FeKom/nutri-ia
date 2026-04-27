"""Generate eval dashboard charts from results.json."""
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

sns.set_theme(style="whitegrid", palette="muted")

FILE_PATH = "tests/eval/analysis/results.json"
OUT_DIR = "tests/eval/analysis"

METRICS = [
    "faithfulness", "answer_relevancy", "context_relevancy",
    "context_recall", "context_precision", "hallucination", "jailbreak", "overall_score",
]
METRIC_LABELS = {
    "faithfulness": "Faithfulness",
    "answer_relevancy": "Answer Relevancy",
    "context_relevancy": "Context Relevancy",
    "context_recall": "Context Recall",
    "context_precision": "Context Precision",
    "hallucination": "Hallucination",
    "jailbreak": "Jailbreak",
    "overall_score": "Overall Score",
}

# ── Load ─────────────────────────────────────────────────────────────────────
with open(FILE_PATH) as f:
    raw = json.load(f)

rows = []
for exp in raw:
    for i, run in enumerate(exp.get("runs", [])):
        result = run.get("result") or {}
        rows.append({
            "experiment_id": exp["id"],
            "experiment": exp["name"],
            "created_at": exp.get("created_at", ""),
            "run_index": i + 1,
            "question": run["question"],
            "question_short": run["question"][:55] + "…" if len(run["question"]) > 55 else run["question"],
            "latency_ms": run.get("latency_ms"),
            **{m: result.get(m) for m in METRICS},
        })

df = pd.DataFrame(rows)

# Filter to experiments that actually have runs
active_exps = df["experiment"].unique().tolist()
print(f"Experiments with data: {active_exps}")

# ── Chart 1: Overall score bar chart ────────────────────────────────────────
summary = (
    df.groupby("experiment")[["overall_score"]].mean()
    .reset_index()
    .sort_values("overall_score", ascending=False)
)

fig, ax = plt.subplots(figsize=(10, 4))
colors = sns.color_palette("muted", n_colors=len(summary))
bars = ax.barh(summary["experiment"], summary["overall_score"], color=colors)
ax.set_xlabel("Overall Score (mean)")
ax.set_xlim(0, 1)
ax.axvline(0.8, color="green", linestyle="--", linewidth=1, alpha=0.6, label="Target > 0.8")
ax.axvline(0.6, color="orange", linestyle="--", linewidth=1, alpha=0.6, label="Minimum > 0.6")
ax.legend(fontsize=9)
ax.bar_label(bars, fmt="%.3f", padding=4, fontsize=9)
ax.invert_yaxis()
ax.set_title("Overall Score per experiment", fontsize=13)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/chart_overall_scores.png", dpi=150)
plt.close()
print("Saved chart_overall_scores.png")

# ── Chart 2: Heatmap for OVERFITTING experiment ──────────────────────────────
OVERFITTING_EXP = "OVERFITTING_EXPERIMENTS_PROMPT_V2"
exp_df = df[df["experiment"] == OVERFITTING_EXP].copy()

heat_metrics = ["faithfulness", "answer_relevancy", "context_relevancy",
                "context_recall", "context_precision", "hallucination", "jailbreak"]
heat = exp_df.set_index("question_short")[heat_metrics]
heat.columns = [METRIC_LABELS[c] for c in heat.columns]

fig, ax = plt.subplots(figsize=(12, max(4, len(heat) * 0.6)))
sns.heatmap(
    heat.astype(float), annot=True, fmt=".2f",
    cmap="RdYlGn", vmin=0, vmax=1,
    linewidths=0.5, ax=ax, cbar_kws={"shrink": 0.6},
)
ax.set_title(f"Métricas por pergunta\n{OVERFITTING_EXP}", fontsize=12)
ax.set_ylabel("")
ax.tick_params(axis="y", labelsize=8)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/chart_overfitting_heatmap.png", dpi=150)
plt.close()
print("Saved chart_overfitting_heatmap.png")

# ── Chart 3: Side-by-side heatmap OVERFITTING vs v2-rerun ───────────────────
V2_EXP = "v2-structured-prompt-rerun"
overfitting_df = df[df["experiment"] == OVERFITTING_EXP].copy()
v2_df = df[df["experiment"] == V2_EXP].copy()

compare_metrics = ["faithfulness", "answer_relevancy"]
fig, axes = plt.subplots(1, 2, figsize=(14, max(5, len(overfitting_df) * 0.55)))

for ax, exp_data, title in [
    (axes[0], overfitting_df, OVERFITTING_EXP),
    (axes[1], v2_df, V2_EXP),
]:
    h = exp_data.set_index("question_short")[compare_metrics]
    h.columns = [METRIC_LABELS[c] for c in compare_metrics]
    sns.heatmap(
        h.astype(float), annot=True, fmt=".2f",
        cmap="RdYlGn", vmin=0.7, vmax=1.0,
        linewidths=0.5, ax=ax, cbar=ax == axes[1],
    )
    mean_score = exp_data["overall_score"].mean()
    ax.set_title(f"{title}\nOverall: {mean_score:.3f}", fontsize=9)
    ax.set_ylabel("")
    ax.tick_params(axis="y", labelsize=7)

plt.suptitle("Overfitting dataset vs Golden dataset (v2 prompt)", fontsize=12, y=1.01)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/chart_comparison.png", dpi=150, bbox_inches="tight")
plt.close()
print("Saved chart_comparison.png")

# ── Chart 4: Score evolution ─────────────────────────────────────────────────
order_map = {
    "test-with-guardhail": "2026-04-23",
    "v2-structured-prompt": "2026-04-25a",
    "v2-structured-prompt-rerun": "2026-04-25b",
    "OVERFITTING_EXPERIMENTS_PROMPT_V2": "2026-04-25c",
}
summary_evo = df.groupby("experiment")[["overall_score", "faithfulness", "answer_relevancy"]].mean().reset_index()
summary_evo["order"] = summary_evo["experiment"].map(order_map)
summary_evo = summary_evo.dropna(subset=["order"]).sort_values("order")

fig, ax = plt.subplots(figsize=(11, 4))
for metric in ["overall_score", "faithfulness", "answer_relevancy"]:
    ax.plot(summary_evo["experiment"], summary_evo[metric], marker="o", label=METRIC_LABELS[metric])
ax.set_ylim(0.6, 1.0)
ax.axhline(0.8, color="green", linestyle="--", linewidth=1, alpha=0.5, label="Target 0.8")
ax.set_xticklabels(summary_evo["experiment"], rotation=20, ha="right", fontsize=9)
ax.set_ylabel("Mean score")
ax.legend(fontsize=9)
ax.set_title("Score evolution across experiments", fontsize=13)
plt.tight_layout()
plt.savefig(f"{OUT_DIR}/chart_evolution.png", dpi=150)
plt.close()
print("Saved chart_evolution.png")

print("\nAll charts saved to", OUT_DIR)
