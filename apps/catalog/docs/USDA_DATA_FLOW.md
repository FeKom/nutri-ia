# Fluxo de Dados USDA Foundation Foods

Este documento descreve o fluxo completo de importação e uso dos dados nutricionais do USDA Foundation Foods no sistema Nutria.

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO DE DADOS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  USDA CSV    │───>│  Processing  │───>│  PostgreSQL  │                  │
│  │  (Raw Data)  │    │   Script     │    │   Database   │                  │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│         │                   │                    │                          │
│         v                   v                    v                          │
│  data/usda/           data/processed/      foods +                         │
│  FoodData_Central_    foods.csv            food_nutrients                  │
│  foundation_food_     food_nutrients.csv   tables                          │
│  csv_2025-12-18/                                                           │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         API LAYER                                     │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐   │  │
│  │  │ /foods/search   │    │ /foods/similar  │    │ /nutrition/calc │   │  │
│  │  │                 │    │                 │    │                 │   │  │
│  │  │ Busca textual   │    │ Busca por       │    │ Calcula totais  │   │  │
│  │  │ de alimentos    │    │ similaridade    │    │ nutricionais    │   │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘   │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    v                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         MASTRA TOOLS                                  │  │
│  │                                                                       │  │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐ │  │
│  │  │ search-food-      │  │ find-similar-     │  │ calculate-        │ │  │
│  │  │ catalog           │  │ foods             │  │ nutrition         │ │  │
│  │  └───────────────────┘  └───────────────────┘  └───────────────────┘ │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    v                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    NUTRITION ANALYST AGENT                            │  │
│  │                                                                       │  │
│  │  O agente usa as tools para responder perguntas como:                │  │
│  │  - "Busque informações sobre frango"                                 │  │
│  │  - "O que posso comer no lugar de arroz?"                            │  │
│  │  - "Calcule as calorias de 200g de peito de frango"                  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Scripts de Processamento

### 1.1 process_foundation_foods.py

**Localização:** `nutria-catalog/scripts/process_foundation_foods.py`

**Função:** Processa os CSVs brutos do USDA e gera arquivos limpos para importação.

**Entrada:**
- `data/usda/FoodData_Central_foundation_food_csv_2025-12-18/`
  - `food.csv` - Informações básicas dos alimentos
  - `food_nutrient.csv` - Valores nutricionais
  - `food_category.csv` - Categorias
  - `foundation_food.csv` - IDs dos Foundation Foods

**Saída:**
- `data/processed/foods.csv` - 324 alimentos processados
- `data/processed/food_nutrients.csv` - Nutrientes correspondentes

**Mapeamento de Nutrientes USDA:**

| USDA ID | Campo no Banco | Descrição |
|---------|----------------|-----------|
| 1008, 2047, 2048 | calories_100g | Energia (kcal) |
| 1003 | protein_g_100g | Proteína |
| 1005 | carbs_g_100g | Carboidratos |
| 1004 | fat_g_100g | Gordura Total |
| 1258 | saturated_fat_g_100g | Gordura Saturada |
| 1079 | fiber_g_100g | Fibra |
| 1063 | sugar_g_100g | Açúcares |
| 1093 | sodium_mg_100g | Sódio |
| 1087 | calcium_mg_100g | Cálcio |
| 1089 | iron_mg_100g | Ferro |
| 1162 | vitamin_c_mg_100g | Vitamina C |

**Execução:**
```bash
cd nutria-catalog
python -m scripts.process_foundation_foods
```

### 1.2 import_to_database.py

**Localização:** `nutria-catalog/scripts/import_to_database.py`

**Função:** Importa os CSVs processados para o PostgreSQL.

**Execução:**
```bash
cd nutria-catalog
python -m scripts.import_to_database
```

## 2. Modelo de Dados

### 2.1 Tabela `foods`

```sql
CREATE TABLE foods (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_normalized VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50),
    serving_size_g NUMERIC(10,2) NOT NULL DEFAULT 100,
    serving_unit VARCHAR(20) NOT NULL DEFAULT 'g',
    calorie_per_100g NUMERIC(10,2),
    usda_id VARCHAR(50) UNIQUE,
    source ENUM('USDA', 'TACO', 'CUSTOM') NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    embedding VECTOR(384),  -- Para busca semântica
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### 2.2 Tabela `food_nutrients`

```sql
CREATE TABLE food_nutrients (
    id UUID PRIMARY KEY,
    food_id UUID REFERENCES foods(id),
    calories_100g NUMERIC(10,2),
    protein_g_100g NUMERIC(10,2),
    carbs_g_100g NUMERIC(10,2),
    fat_g_100g NUMERIC(10,2),
    saturated_fat_g_100g NUMERIC(10,2),
    fiber_g_100g NUMERIC(10,2),
    sugar_g_100g NUMERIC(10,2),
    sodium_mg_100g NUMERIC(10,2),
    calcium_mg_100g NUMERIC(10,2),
    iron_mg_100g NUMERIC(10,2),
    vitamin_c_mg_100g NUMERIC(10,2),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

## 3. API Endpoints

### 3.1 POST /api/v1/foods/search

Busca textual de alimentos.

**Request:**
```json
{
  "query": "chicken breast",
  "limit": 10,
  "filters": {
    "category": "Poultry Products",
    "min_protein": 20,
    "max_calories": 200,
    "verified_only": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "foods": [
    {
      "id": "uuid",
      "name": "Chicken, broiler, breast, skinless",
      "category": "Poultry Products",
      "serving_size_g": 100,
      "serving_unit": "g",
      "calorie_per_100g": 165,
      "source": "USDA",
      "is_verified": true,
      "protein_g_100g": 31,
      "carbs_g_100g": 0,
      "fat_g_100g": 3.6
    }
  ],
  "count": 1
}
```

### 3.2 POST /api/v1/foods/similar

Encontra alimentos com perfil nutricional similar.

**Request:**
```json
{
  "food_id": "uuid-do-alimento",
  "limit": 10,
  "same_category": false,
  "tolerance": 0.3
}
```

**Response:**
```json
{
  "success": true,
  "reference_food": {
    "id": "uuid",
    "name": "Chicken Breast",
    "calorie_per_100g": 165,
    "protein_g_100g": 31,
    "carbs_g_100g": 0,
    "fat_g_100g": 3.6
  },
  "similar_foods": [
    {
      "id": "uuid",
      "name": "Turkey Breast",
      "calorie_per_100g": 157,
      "protein_g_100g": 29,
      "carbs_g_100g": 0,
      "fat_g_100g": 3.2,
      "similarity_score": 0.92
    }
  ],
  "count": 1
}
```

**Cálculo de Similaridade:**
- Calorias: 30% do peso
- Proteína: 25% do peso
- Carboidratos: 20% do peso
- Gordura: 15% do peso
- Fibra: 10% do peso

### 3.3 POST /api/v1/nutrition/calculate

Calcula valores nutricionais totais.

**Request:**
```json
{
  "foods": [
    {"food_id": "uuid-1", "quantity": 150},
    {"food_id": "uuid-2", "quantity": 100}
  ]
}
```

## 4. Mastra Tools

### 4.1 search-food-catalog

Busca alimentos no catálogo.

```typescript
// Input
{
  query: "frango",
  limit: 5
}

// Output
{
  success: true,
  foods: [...],
  count: 5
}
```

### 4.2 find-similar-foods

Encontra substitutos nutricionais.

```typescript
// Input
{
  foodId: "uuid",
  limit: 10,
  sameCategory: false,
  tolerance: 0.3
}

// Output
{
  success: true,
  referenceFood: {...},
  similarFoods: [...],
  count: 10
}
```

### 4.3 calculate-nutrition

Calcula totais nutricionais.

```typescript
// Input
{
  foods: [
    { foodId: "uuid", quantity_g: 150 }
  ]
}

// Output
{
  success: true,
  total: { calories: 247, protein_g: 46.5, ... },
  details: [...]
}
```

## 5. Exemplos de Uso

### 5.1 Buscar Substitutos para um Alimento

**Pergunta do usuário:**
> "Me fale quais alimentos podem substituir o peito de frango na minha dieta para um similar com valores nutricionais parecidos"

**Fluxo:**
1. Agente usa `search-food-catalog` para encontrar "peito de frango"
2. Obtém o ID do alimento
3. Usa `find-similar-foods` com o ID
4. Retorna lista de substitutos ordenados por similaridade

**Resposta esperada:**
```
Encontrei alternativas para o Peito de Frango (165 kcal, 31g proteína por 100g):

1. **Peito de Peru** (157 kcal) - 92% similar
   - Proteína: 29g | Carbs: 0g | Gordura: 3.2g

2. **Lombo Suíno** (143 kcal) - 85% similar
   - Proteína: 27g | Carbs: 0g | Gordura: 3.5g

3. **Filé de Tilápia** (128 kcal) - 78% similar
   - Proteína: 26g | Carbs: 0g | Gordura: 2.7g

Todas são ótimas fontes de proteína magra!
```

### 5.2 Calcular Refeição

**Pergunta:**
> "Calcule as calorias de 200g de arroz com 150g de frango"

**Fluxo:**
1. Busca "arroz" e "frango"
2. Usa `calculate-nutrition` com as quantidades
3. Retorna totais

## 6. Próximos Passos

1. **Busca Semântica:** Adicionar embeddings para busca por contexto
2. **Mais Fontes:** Integrar dados TACO (tabela brasileira)
3. **Cache:** Implementar cache para buscas frequentes
4. **Histórico:** Salvar consultas do usuário para personalização
