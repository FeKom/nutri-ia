# Quick Start - Sistema de Rastreamento

## 1. Executar Migrations

Antes de usar o sistema de tracking, execute as migrations para criar as tabelas no banco de dados:

```bash
cd /Users/vinic/company/nutria-catalog
alembic upgrade head
```

Isso criará as seguintes tabelas:
- `meal_logs` - Registros de refeições
- `daily_stats` - Estatísticas diárias agregadas
- `user_profiles` - Perfis de usuários (se ainda não existir)
- `meal_plans` - Planos alimentares (se ainda não existir)

## 2. Iniciar o Servidor

```bash
uvicorn app.main:app --reload
```

O servidor estará disponível em `http://localhost:8000`

## 3. Acessar a Documentação

Abra no navegador:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 4. Exemplos de Uso

### 4.1. Registrar uma Refeição

```bash
curl -X POST "http://localhost:8000/api/v1/tracking/meals/log" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "meal_type": "breakfast",
    "foods": [
      {
        "food_id": "food-uuid-aqui",
        "quantity_g": 50,
        "name": "Aveia"
      }
    ],
    "notes": "Café da manhã saudável"
  }'
```

### 4.2. Obter Resumo do Dia

```bash
curl -X GET "http://localhost:8000/api/v1/tracking/summary/daily?user_id=550e8400-e29b-41d4-a716-446655440000&date=2024-01-27"
```

### 4.3. Estatísticas da Semana

```bash
curl -X GET "http://localhost:8000/api/v1/tracking/stats/weekly?user_id=550e8400-e29b-41d4-a716-446655440000&days=7"
```

## 5. Testar com Python

```python
import requests
from datetime import datetime
from uuid import uuid4

# Configuração
BASE_URL = "http://localhost:8000/api/v1"
user_id = str(uuid4())  # Seu user_id aqui

# 1. Buscar um alimento
foods_response = requests.post(
    f"{BASE_URL}/foods/search",
    json={"query": "arroz", "limit": 5}
)
arroz = foods_response.json()["foods"][0]

# 2. Registrar refeição
meal_response = requests.post(
    f"{BASE_URL}/tracking/meals/log",
    json={
        "user_id": user_id,
        "meal_type": "lunch",
        "foods": [
            {
                "food_id": arroz["id"],
                "quantity_g": 150,
                "name": arroz["name"]
            }
        ],
        "notes": "Almoço"
    }
)
meal = meal_response.json()
print(f"Refeição registrada: {meal['total_calories']} kcal")

# 3. Ver resumo do dia
summary_response = requests.get(
    f"{BASE_URL}/tracking/summary/daily",
    params={
        "user_id": user_id,
        "date": datetime.now().strftime("%Y-%m-%d")
    }
)
summary = summary_response.json()
print(f"Total do dia: {summary['totals']['calories']} kcal")
print(f"Refeições: {summary['num_meals']}")
```

## 6. Testar com JavaScript/TypeScript

```typescript
const BASE_URL = "http://localhost:8000/api/v1";
const userId = "550e8400-e29b-41d4-a716-446655440000";

// 1. Buscar alimento
const searchFood = async (query: string) => {
  const response = await fetch(`${BASE_URL}/foods/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, limit: 5 })
  });
  return response.json();
};

// 2. Registrar refeição
const logMeal = async (mealType: string, foods: any[], notes?: string) => {
  const response = await fetch(`${BASE_URL}/tracking/meals/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      meal_type: mealType,
      foods,
      notes
    })
  });
  return response.json();
};

// 3. Obter resumo diário
const getDailySummary = async (date?: string) => {
  const params = new URLSearchParams({
    user_id: userId,
    date: date || new Date().toISOString().split('T')[0]
  });
  const response = await fetch(`${BASE_URL}/tracking/summary/daily?${params}`);
  return response.json();
};

// Exemplo de uso
async function exemplo() {
  // Buscar arroz
  const foods = await searchFood('arroz');
  const arroz = foods.foods[0];

  // Registrar almoço
  const meal = await logMeal('lunch', [
    {
      food_id: arroz.id,
      quantity_g: 150,
      name: arroz.name
    }
  ], 'Almoço pós-treino');

  console.log(`Refeição: ${meal.total_calories} kcal`);

  // Ver resumo
  const summary = await getDailySummary();
  console.log(`Total do dia: ${summary.totals.calories} kcal`);
}
```

## 7. Verificar Saúde da API

```bash
curl http://localhost:8000/health
```

Resposta esperada:
```json
{
  "status": "healthy",
  "service": "Nutria Food Catalog API",
  "version": "1.0.0"
}
```

## 8. Executar Testes

```bash
# Instalar dependências de teste
pip install pytest pytest-asyncio httpx

# Executar todos os testes
pytest tests/ -v

# Apenas testes de tracking
pytest tests/test_tracking_service.py -v

# Com cobertura
pip install pytest-cov
pytest tests/ --cov=app.services.tracking_service --cov-report=html
```

## Troubleshooting

### Erro: "Table does not exist"
Execute as migrations: `alembic upgrade head`

### Erro: "Food not found"
Certifique-se de que há alimentos cadastrados no banco. Use o endpoint `/api/foods/search` para verificar.

### Erro de conexão com banco de dados
Verifique:
1. PostgreSQL está rodando
2. Variáveis de ambiente em `.env` estão corretas
3. Extensão `pgvector` está instalada: `CREATE EXTENSION IF NOT EXISTS vector;`

## Próximos Passos

1. ✅ Explorar API na documentação interativa: http://localhost:8000/docs
2. ✅ Testar endpoints com exemplos acima
3. ✅ Integrar com seu Agent (Mastra.ai)
4. ✅ Personalizar metas nutricionais no UserProfile
5. ✅ Adicionar mais alimentos ao catálogo

## Recursos

- [Documentação Completa do Sistema de Tracking](./TRACKING_SYSTEM.md)
- [Documentação da API](http://localhost:8000/docs)
- [Backend Sprint 1 - Roadmap](../docs/tech/backend-sprint-1.md)
