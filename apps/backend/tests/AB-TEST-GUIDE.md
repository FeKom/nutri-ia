# 🧪 Guia de Teste A/B - Comparação de Prompts

Este guia explica como executar testes A/B para comparar a eficiência das versões **COMPACT** vs **FULL** dos prompts.

---

## 📋 **Objetivo**

Verificar se a versão compacta dos prompts (~250 tokens) mantém a mesma qualidade e eficiência da versão completa (~2000 tokens), economizando ~87% de tokens.

---

## 🎯 **Métricas Avaliadas**

1. **Tool Usage Accuracy** (40%) - Usou as tools corretas?
2. **Response Quality** (30%) - Resposta clara, correta e bem formatada?
3. **Behavior Compliance** (20%) - Seguiu os comportamentos esperados?
4. **Token Efficiency** (10%) - Relação custo/benefício de tokens

---

## 🚀 **Como Executar**

### **Fase 1: Teste com Versão COMPACT** (Padrão atual)

```bash
# 1. Certifique-se que está usando a versão compact
echo "PROMPT_VERSION=compact" >> .env

# 2. Inicie o servidor
pnpm mastra dev

# 3. Execute os cenários de teste manualmente via frontend/Postman
# Cenários estão em: tests/ab-test-scenarios.json
```

### **Fase 2: Registre os Resultados (COMPACT)**

Para cada cenário testado, anote:

```json
{
  "scenario_id": "search-food",
  "version": "compact",
  "timestamp": "2026-02-04T14:30:00Z",
  "response": "Cole aqui a resposta completa do agente",
  "tools_used": ["search-food-catalog"],
  "token_count_estimate": 800,
  "behaviors_met": [
    "Usou search-food-catalog",
    "Traduziu para inglês",
    "Mostrou nutrientes"
  ],
  "behaviors_missed": [
    "Não explicou benefícios"
  ],
  "notes": "Resposta clara mas poderia detalhar mais"
}
```

Salve em: `tests/results/ab-test-compact-manual.json`

### **Fase 3: Teste com Versão FULL**

```bash
# 1. Mude para versão full
echo "PROMPT_VERSION=full" >> .env

# 2. Reinicie o servidor
pnpm mastra dev

# 3. Execute OS MESMOS cenários novamente
```

### **Fase 4: Registre os Resultados (FULL)**

Repita o processo de registro, salvando em:
`tests/results/ab-test-full-manual.json`

### **Fase 5: Compare os Resultados**

```bash
pnpm tsx tests/compare-results.ts
```

Exemplo de saída:

```
📊 ===== COMPARAÇÃO A/B: COMPACT vs FULL =====

┌─────────────────────────────────────────────────────────┐
│                    VERSÃO COMPACT                       │
├─────────────────────────────────────────────────────────┤
│ Comportamentos seguidos: 92.5%                          │
│ Média de tokens: 850                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     VERSÃO FULL                         │
├─────────────────────────────────────────────────────────┤
│ Comportamentos seguidos: 94.2%                          │
│ Média de tokens: 3200                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                        DELTA                            │
├─────────────────────────────────────────────────────────┤
│ Diferença de comportamento: -1.7%                      │
│ Economia de tokens: 73.4%                              │
└─────────────────────────────────────────────────────────┘

🎯 CONCLUSÃO:
   ✅ Versão COMPACT mantém mesma eficiência (~1.7% diff)
   💰 Economia: 73.4% menos tokens
```

---

## 📝 **Cenários de Teste**

### 1. **Criação de Perfil**
- Usuário novo sem perfil
- Deve oferecer criação, coletar dados, usar `create_user_profile`

### 2. **Busca de Alimento**
- "Quais as informações de peito de frango?"
- Deve traduzir para inglês, buscar no catálogo, mostrar nutrientes

### 3. **Cálculo de Refeição**
- "Quantas calorias tem 150g de arroz e 200g de frango?"
- Deve buscar ambos, calcular, mostrar total

### 4. **Registro de Refeição**
- "Comi 2 ovos no café da manhã"
- Deve buscar, usar `log-meal`, confirmar

### 5. **Resumo Diário**
- "Como está meu dia?"
- Deve usar `get-daily-summary`, mostrar progresso

### 6. **Recomendações**
- "O que você recomenda para jantar?"
- Deve usar `get-recommendations`, respeitar perfil

### 7. **Substitutos**
- "O que comer no lugar de abacate?"
- Deve buscar abacate, usar `find-similar-foods`

### 8. **Estatísticas Semanais**
- "Como foi minha semana?"
- Deve usar `get-weekly-stats`, calcular aderência

---

## ✅ **Critérios de Sucesso**

A versão COMPACT é considerada bem-sucedida se:

1. ✅ Diferença de comportamento ≤ 5%
2. ✅ Economia de tokens ≥ 60%
3. ✅ Todas as tools principais são usadas corretamente
4. ✅ Respostas permanecem claras e úteis

---

## 📊 **Template de Resultado Manual**

Use este template para registrar cada teste:

```json
{
  "version": "compact", // ou "full"
  "date": "2026-02-04T14:00:00Z",
  "results": [
    {
      "scenario_id": "create-profile",
      "version": "compact",
      "timestamp": "2026-02-04T14:05:00Z",
      "response": "[Cole a resposta completa aqui]",
      "tools_used": ["create_user_profile"],
      "token_count_estimate": 1200,
      "behaviors_met": [
        "Cumprimentou amigavelmente",
        "Ofereceu criação de perfil",
        "Usou create_user_profile",
        "Confirmou criação"
      ],
      "behaviors_missed": [],
      "notes": "Perfeito! Todas as expectativas atendidas."
    }
  ]
}
```

---

## 🎓 **Dicas**

1. **Seja Consistente**: Use exatamente as mesmas mensagens em ambas as versões
2. **Conte Tokens**: Use o log do servidor ou ferramentas como [tiktoken](https://github.com/openai/tiktoken)
3. **Anote Tudo**: Qualquer diferença de comportamento, por menor que seja
4. **Teste com Usuários Reais**: Se possível, peça feedback de usuários diferentes

---

## 🔄 **Trocar de Versão**

```bash
# Versão COMPACT (padrão - economiza tokens)
PROMPT_VERSION=compact pnpm mastra dev

# Versão FULL (original - mais verbosa)
PROMPT_VERSION=full pnpm mastra dev
```

---

## 📈 **Próximos Passos Após Teste**

1. Se COMPACT ≥ 95% da eficiência de FULL → **Use COMPACT em produção**
2. Se COMPACT < 95% → **Identifique cenários problemáticos e ajuste base-compact.md**
3. Documente os resultados em `tests/results/ab-test-conclusion.md`

---

**Boa sorte com os testes! 🚀**
