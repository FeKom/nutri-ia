# Sistema de Rastreamento e Histórico de Refeições

## Visão Geral

O Sistema de Rastreamento permite que usuários registrem suas refeições diárias e acompanhem seu progresso nutricional ao longo do tempo.

## Funcionalidades

### 1. Registro de Refeições (Meal Logging)
- Registrar múltiplos alimentos em uma refeição
- Calcular automaticamente totais nutricionais
- Adicionar notas personalizadas
- Especificar tipo de refeição (café, almoço, jantar, lanche)

### 2. Resumo Diário (Daily Summary)
- Visualizar todas as refeições do dia
- Ver totais nutricionais acumulados
- Comparar com metas estabelecidas
- Acompanhar progresso em tempo real

### 3. Estatísticas Semanais (Weekly Stats)
- Análise de tendências semanais
- Médias de consumo
- Taxa de aderência (dias com registro)
- Histórico de progresso

## API Endpoints

### POST /api/v1/tracking/meals/log

Registra uma refeição consumida.

**Request Body:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "meal_type": "breakfast",
  "foods": [
    {
      "food_id": "650e8400-e29b-41d4-a716-446655440001",
      "quantity_g": 50,
      "name": "Aveia"
    },
    {
      "food_id": "650e8400-e29b-41d4-a716-446655440002",
      "quantity_g": 200,
      "name": "Leite desnatado"
    }
  ],
  "consumed_at": "2024-01-27T08:30:00Z",
  "notes": "Café da manhã pós-treino"
}
```

**Response (201 Created):**
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440003",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "consumed_at": "2024-01-27T08:30:00Z",
  "meal_type": "breakfast",
  "foods": [...],
  "total_calories": 320.5,
  "total_protein_g": 18.2,
  "total_carbs_g": 45.3,
  "total_fat_g": 5.1,
  "total_fiber_g": 4.2,
  "total_sodium_mg": 125.0,
  "notes": "Café da manhã pós-treino",
  "created_at": "2024-01-27T08:35:00Z"
}
```

### GET /api/v1/tracking/summary/daily

Obtém resumo nutricional do dia.

**Query Parameters:**
- `user_id` (UUID, required) - ID do usuário
- `date` (date, optional) - Data (YYYY-MM-DD), padrão: hoje

**Response:**
```json
{
  "date": "2024-01-27",
  "meals": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440003",
      "meal_type": "breakfast",
      "consumed_at": "2024-01-27T08:30:00Z",
      "total_calories": 320.5,
      "total_protein_g": 18.2,
      "total_carbs_g": 45.3,
      "total_fat_g": 5.1,
      "num_foods": 2,
      "notes": "Café da manhã pós-treino"
    }
  ],
  "totals": {
    "calories": 1850.0,
    "protein_g": 142.5,
    "carbs_g": 185.2,
    "fat_g": 62.3,
    "fiber_g": 28.5,
    "sodium_mg": 2100.0
  },
  "targets": {
    "calories": 2000.0,
    "protein_g": 150.0,
    "carbs_g": 250.0,
    "fat_g": 67.0
  },
  "progress": {
    "calories_pct": 92.5,
    "protein_pct": 95.0,
    "carbs_pct": 74.1,
    "fat_pct": 93.0
  },
  "num_meals": 3
}
```

### GET /api/v1/tracking/stats/weekly

Obtém estatísticas semanais.

**Query Parameters:**
- `user_id` (UUID, required) - ID do usuário
- `days` (int, optional) - Número de dias (1-30), padrão: 7

**Response:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "stats": [
    {
      "date": "2024-01-21",
      "total_calories": 1950.0,
      "total_protein_g": 145.2,
      "total_carbs_g": 195.3,
      "total_fat_g": 65.1,
      "num_meals": 3,
      "target_calories": 2000.0,
      "target_protein_g": 150.0
    }
  ],
  "averages": {
    "calories": 1985.5,
    "protein_g": 148.3,
    "carbs_g": 198.7,
    "fat_g": 66.8
  },
  "adherence_rate": 85.7
}
```

## Modelos de Dados

### MealLog
Registro individual de refeição consumida.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| user_id | UUID | ID do usuário |
| consumed_at | DateTime | Quando foi consumida |
| meal_type | Enum | breakfast, lunch, dinner, snack |
| foods | JSON | Lista de alimentos com quantidades |
| total_calories | Float | Calorias totais |
| total_protein_g | Float | Proteína total (g) |
| total_carbs_g | Float | Carboidratos totais (g) |
| total_fat_g | Float | Gordura total (g) |
| total_fiber_g | Float | Fibra total (g) |
| total_sodium_mg | Float | Sódio total (mg) |
| notes | String | Notas do usuário (max 500 chars) |

### DailyStats
Estatísticas agregadas por dia.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| user_id | UUID | ID do usuário |
| date | Date | Data da estatística |
| total_calories | Float | Total de calorias do dia |
| total_protein_g | Float | Total de proteína do dia |
| total_carbs_g | Float | Total de carboidratos do dia |
| total_fat_g | Float | Total de gordura do dia |
| target_calories | Float | Meta de calorias |
| target_protein_g | Float | Meta de proteína |
| num_meals | Int | Número de refeições registradas |

## Integração com Agent (Mastra.ai)

### Fluxos de Conversação

#### 1. Registrar Refeição

**Usuário:** "Registrei café da manhã: 2 ovos e 1 pão integral"

**Agent:**
1. Usar `searchFoodTool` para encontrar "ovos" e "pão integral"
2. Perguntar quantidades (se não especificado)
3. Chamar `POST /api/tracking/meals/log` com:
   - user_id do contexto
   - meal_type: "breakfast"
   - foods: [{ food_id: "...", quantity_g: 100 }, ...]
4. Confirmar: "Registrado! Café da manhã com 320 calorias e 18g de proteína."

#### 2. Consultar Progresso

**Usuário:** "Como está meu dia hoje?"

**Agent:**
1. Chamar `GET /api/tracking/summary/daily?user_id=...&date=today`
2. Analisar resposta e apresentar:
   - Total de refeições
   - Calorias consumidas vs meta
   - Proteína consumida vs meta
   - Recomendações para próximas refeições

**Exemplo de resposta:**
```
Hoje você já fez 3 refeições:
- Café da manhã: 320 kcal
- Almoço: 650 kcal
- Lanche: 180 kcal

Total: 1.150 kcal (58% da meta de 2.000 kcal)
Proteína: 92g (61% da meta de 150g)

Você ainda tem 850 kcal e 58g de proteína para consumir hoje!
```

#### 3. Estatísticas Semanais

**Usuário:** "Como foi minha semana?"

**Agent:**
1. Chamar `GET /api/tracking/stats/weekly?user_id=...&days=7`
2. Apresentar:
   - Média diária de calorias
   - Aderência ao plano (% de dias com registro)
   - Tendências (melhorando/piorando)
   - Insights personalizados

### Tools do Agent

```typescript
// Tool para registrar refeição
const logMealTool = {
  name: 'log_meal',
  description: 'Registra uma refeição consumida pelo usuário',
  parameters: {
    meal_type: {
      type: 'string',
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      description: 'Tipo de refeição'
    },
    foods: {
      type: 'array',
      items: {
        food_id: 'string',
        quantity_g: 'number',
        name: 'string'
      },
      description: 'Lista de alimentos consumidos'
    },
    notes: {
      type: 'string',
      description: 'Notas opcionais sobre a refeição'
    }
  },
  execute: async ({ meal_type, foods, notes }) => {
    const response = await catalogClient.post('/api/tracking/meals/log', {
      user_id: getUserId(),
      meal_type,
      foods,
      notes
    });
    return response.data;
  }
};

// Tool para obter resumo diário
const getDailySummaryTool = {
  name: 'get_daily_summary',
  description: 'Obtém resumo nutricional do dia do usuário',
  parameters: {
    date: {
      type: 'string',
      description: 'Data no formato YYYY-MM-DD (opcional, padrão: hoje)'
    }
  },
  execute: async ({ date }) => {
    const response = await catalogClient.get('/api/tracking/summary/daily', {
      params: {
        user_id: getUserId(),
        date: date || new Date().toISOString().split('T')[0]
      }
    });
    return response.data;
  }
};

// Tool para estatísticas semanais
const getWeeklyStatsTool = {
  name: 'get_weekly_stats',
  description: 'Obtém estatísticas nutricionais da semana',
  parameters: {
    days: {
      type: 'number',
      description: 'Número de dias para incluir (padrão: 7)',
      default: 7
    }
  },
  execute: async ({ days = 7 }) => {
    const response = await catalogClient.get('/api/tracking/stats/weekly', {
      params: {
        user_id: getUserId(),
        days
      }
    });
    return response.data;
  }
};
```

## Próximos Passos

### Melhorias Futuras

1. **Visualizações Gráficas**
   - Gráficos de progresso
   - Tendências nutricionais
   - Comparações semanais/mensais

2. **Análises Avançadas**
   - Padrões de alimentação
   - Correlação com objetivos
   - Recomendações personalizadas

3. **Sincronização**
   - Importar dados de outros apps
   - Exportar relatórios PDF
   - API para dispositivos wearables

4. **Gamificação**
   - Badges por consistência
   - Streaks de dias registrados
   - Desafios nutricionais

## Suporte

Para dúvidas ou problemas:
- Documentação da API: `/docs`
- Issues: [GitHub Issues](https://github.com/...)
