# Avaliação do Agente Nutria

Este diretório contém a infraestrutura de análise para medir a qualidade do agente Nutria ao longo do tempo.

---

## Estrutura

```
tests/eval/
├── datasets/
│   ├── golden_dataset.json      # 10 perguntas com respostas esperadas
│   ├── overfitting_dataset.json # 10 perguntas sem respostas (só avalia busca)
│   └── chunck_dataset.pdf       # Documento de referência nutricional para RAG
└── analysis/
    ├── README.md                # Este arquivo
    └── notebooks/               # Jupyter Notebooks — análise e gráficos ficam aqui
```

---

## Os três datasets

### 1. `golden_dataset.json` — Avaliação completa

Contém 10 pares pergunta + resposta esperada. É o dataset principal: avalia se o agente consegue recuperar os contextos certos **e** gerar respostas corretas.

**Scorers utilizados (5):**
- `faithfulness` — a resposta é fiel ao contexto recuperado?
- `answer_relevancy` — a resposta é relevante para a pergunta?
- `context_relevancy` — o contexto recuperado é relevante para a pergunta?
- `context_recall` — o contexto recuperado cobre tudo que estava na resposta esperada?
- `context_precision` — os trechos mais importantes aparecem no topo do contexto?

### 2. `overfitting_dataset.json` — Avaliação de busca

Contém 10 perguntas **sem** respostas esperadas. Avalia exclusivamente a qualidade da recuperação de contexto (RAG), sem medir geração de resposta.

**Scorers utilizados (3):**
- `answer_relevancy`
- `context_relevancy`
- `context_precision`

> Use este dataset para testar mudanças no pipeline de embeddings ou chunking sem precisar de ground truth.

### 3. `chunck_dataset.pdf` — Base de conhecimento de referência

Documento de referência nutricional com 7 seções:
1. Macronutrientes (proteínas, carboidratos, gorduras)
2. Tabela de composição de alimentos (baseada na TACO)
3. Nutrição peri-treino
4. Metas nutricionais e cálculo de macros (Mifflin-St Jeor)
5. Grupos específicos (vegetarianos, saúde intestinal, hidratação)
6. Micronutrientes essenciais
7. Alimentação e bem-estar mental

---

## O que cada métrica significa

| Métrica | O que mede | Valor ideal |
|---|---|---|
| `faithfulness` | A resposta não alucina — tudo que diz está no contexto | > 0.8 |
| `answer_relevancy` | A resposta realmente responde à pergunta feita | > 0.8 |
| `context_relevancy` | Os trechos recuperados são sobre o assunto da pergunta | > 0.7 |
| `context_recall` | O contexto recuperado cobre a resposta esperada | > 0.7 |
| `context_precision` | Os trechos mais úteis aparecem primeiro (ranking) | > 0.7 |

Todas as métricas são calculadas por **similaridade de embeddings** (cosseno) — não há LLM-as-judge neste projeto.

---

## Como medir melhorias no agente

1. Faça sua mudança (novo prompt, novo chunking, novo modelo de embedding, etc.)
2. Crie e rode um novo experimento pela UI ou via curl
3. Compare os scores com a execução anterior no notebook
4. Score melhor em `golden_dataset` + score estável em `overfitting_dataset` = melhoria real

### Sinais de alerta

- `context_recall` alto mas `faithfulness` baixo → recupera bem mas alucina na resposta
- `context_precision` baixo → chunks mais relevantes não estão sendo priorizados
- `overfitting_dataset` piora enquanto `golden_dataset` melhora → overfitting no prompt
- `answer_relevancy` baixo em todos → problema no prompt, não no RAG

---

## Notebooks

Os Jupyter Notebooks ficam em `notebooks/`. Gráficos e análises vivem dentro do próprio notebook — não há pasta separada para exportações.
