# Skill: Business to Tech - Nutria Context

## Descrição

Esta skill fornece contexto especializado para assistência de código no projeto Nutria, um assistente nutricional baseado em IA. O assistente deve entender tanto os requisitos de negócio quanto a arquitetura técnica para fornecer sugestões de código alinhadas com os objetivos do produto.

## Contexto de Negócio

### Visão do Produto
Nutria é um assistente nutricional conversacional que ajuda usuários a:
- Encontrar alimentos e entender sua composição nutricional
- Calcular valores nutricionais de refeições
- Receber recomendações personalizadas de dietas
- Rastrear consumo alimentar e progresso

### Personas de Usuário

**Persona 1: João - Atleta Amador**
- Objetivo: Ganhar massa muscular
- Necessidade: Dieta rica em proteínas, calculada com precisão
- Frustrações: Apps complexos, dados imprecisos

**Persona 2: Maria - Profissional Ocupada**
- Objetivo: Perder peso de forma saudável
- Necessidade: Recomendações rápidas, receitas simples
- Frustrações: Falta de tempo para planejar refeições

**Persona 3: Carlos - Pré-diabético**
- Objetivo: Controlar glicemia
- Necessidade: Monitorar carboidratos, alimentos de baixo índice glicêmico
- Frustrações: Dificuldade em entender rótulos

### Requisitos de Negócio Críticos

1. **Precisão Nutricional**: Dados devem ser 95%+ precisos (fonte: USDA, TACO)
2. **Velocidade**: Respostas do agent < 3 segundos
3. **Personalização**: Recomendações baseadas em perfil individual
4. **Conversacional**: Interface natural, sem jargões técnicos
5. **Confiável**: Sempre citar fontes, evitar recomendações médicas

## Contexto Técnico

### Arquitetura do Sistema

```
┌─────────────┐
│   Usuário   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Agent Backend      │ (Mastra.ai + Claude)
│  - Conversação      │
│  - Contexto         │
│  - Tools            │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Catalog API        │ (FastAPI + PostgreSQL)
│  - Busca Alimentos  │
│  - Cálculos         │
│  - Recomendações    │
└─────────────────────┘
```

### Stack Tecnológica

**Agent Backend:**
- Framework: Mastra.ai
- LLM: Claude (Anthropic)
- Runtime: Node.js/TypeScript

**Catalog API:**
- Framework: FastAPI (Python 3.11)
- ORM: SQLModel
- Database: PostgreSQL 15 + pgvector
- Migrations: Alembic

**Features Avançadas:**
- Busca semântica (sentence-transformers)
- Recomendação de dietas (algoritmos de otimização)
- Rastreamento (séries temporais)

### Padrões de Código

#### Python (Catalog API)

**Estrutura de Serviços:**
```python
# app/services/exemplo_service.py
from sqlmodel import Session
from typing import List, Optional

class ExemploService:
    """Serviço para [descrição do domínio]"""

    def __init__(self, session: Session):
        self.session = session

    def operacao_principal(self, param: str) -> Result:
        """
        Descrição clara da operação

        Args:
            param: Descrição do parâmetro

        Returns:
            Descrição do retorno

        Raises:
            ValueError: Quando [condição]
        """
        # Validações
        if not param:
            raise ValueError("Parâmetro não pode ser vazio")

        # Lógica de negócio
        result = self._processamento_interno(param)

        return result

    def _processamento_interno(self, param: str) -> Any:
        """Método privado auxiliar"""
        pass
```

**Endpoints FastAPI:**
```python
# app/api/v1/exemplo.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

router = APIRouter()

@router.post("/recurso", response_model=RespostaSchema)
async def criar_recurso(
    request: RequisicaoSchema,
    db: Session = Depends(get_db)
) -> RespostaSchema:
    """
    Breve descrição do endpoint

    Descrição detalhada em formato markdown para Swagger
    """
    try:
        service = ExemploService(db)
        result = service.operacao_principal(request.param)
        return RespostaSchema(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
```

#### TypeScript (Agent Backend)

**Tools do Agent:**
```typescript
// src/tools/exemploTool.ts
import { Tool } from '@mastra/core';

export const exemploTool: Tool = {
  name: 'exemplo_tool',
  description: 'Descrição clara do que a tool faz, para o LLM entender quando usar',
  parameters: {
    type: 'object',
    properties: {
      param: {
        type: 'string',
        description: 'Descrição do parâmetro para o LLM'
      }
    },
    required: ['param']
  },
  execute: async ({ param }) => {
    try {
      // Chamar API externa
      const response = await catalogClient.post('/api/recurso', { param });

      // Formatar resposta para o LLM
      return {
        success: true,
        data: response.data,
        message: 'Mensagem amigável sobre o resultado'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

### Convenções de Nomenclatura

**Python:**
- Classes: `PascalCase` (ex: `FoodService`, `UserProfile`)
- Funções/métodos: `snake_case` (ex: `calculate_nutrition`, `get_user_profile`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `MAX_ITEMS_PER_PAGE`)
- Variáveis privadas: `_prefixo` (ex: `_internal_cache`)

**TypeScript:**
- Classes/Interfaces: `PascalCase` (ex: `CatalogClient`, `FoodResponse`)
- Funções/variáveis: `camelCase` (ex: `searchFoods`, `userId`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `API_BASE_URL`)

**Banco de Dados:**
- Tabelas: `snake_case` plural (ex: `foods`, `meal_plans`, `user_profiles`)
- Colunas: `snake_case` (ex: `created_at`, `protein_g_100g`)
- Índices: `idx_tabela_coluna` (ex: `idx_foods_category`)

### Domínios e Entidades

**Core Entities:**

1. **Food** (Alimento)
   - Representa um item alimentar
   - Campos: nome, categoria, porção, calorias, fonte
   - Relacionamento: 1:1 com FoodNutrient

2. **FoodNutrient** (Nutrientes)
   - Informações nutricionais detalhadas
   - Sempre por 100g para normalização
   - Campos: proteínas, carboidratos, gorduras, vitaminas, minerais

3. **UserProfile** (Perfil do Usuário)
   - Dados pessoais e objetivos
   - Campos: idade, peso, altura, objetivo, restrições
   - Usado para personalização

4. **MealPlan** (Plano Alimentar)
   - Plano gerado pelo sistema
   - Contém múltiplas refeições
   - Campos: totais diários, refeições (JSON), status

5. **MealLog** (Registro de Refeição)
   - Refeição consumida pelo usuário
   - Para rastreamento e histórico
   - Campos: data/hora, alimentos, totais

### Regras de Negócio

**Cálculos Nutricionais:**
```python
# SEMPRE usar esta fórmula
valor_total = (valor_por_100g / 100) * quantidade_em_gramas

# Exemplo:
# Proteína em 150g de frango (31g proteína/100g)
proteina_total = (31 / 100) * 150  # = 46.5g
```

**Validações:**
- Porções devem ser > 0
- Calorias não podem ser negativas
- Macros devem somar aproximadamente as calorias totais
  - Proteína: 4 kcal/g
  - Carboidrato: 4 kcal/g
  - Gordura: 9 kcal/g

**Restrições Alimentares (padrão):**
- vegetarian: sem carnes
- vegan: sem produtos animais
- gluten_free: sem glúten
- lactose_free: sem lactose
- low_carb: < 30g carbs/100g
- high_protein: > 15g proteína/100g

### Boas Práticas

**Para Agent (Conversacional):**

1. **Sempre validar inputs do usuário:**
   ```typescript
   // ❌ Ruim
   const quantity = parseInt(userInput);

   // ✅ Bom
   const quantity = parseFloat(userInput);
   if (isNaN(quantity) || quantity <= 0) {
     return "Por favor, informe uma quantidade válida (ex: 150g)";
   }
   ```

2. **Responder de forma natural:**
   ```typescript
   // ❌ Ruim (muito técnico)
   return `Food ID: ${foodId}, Calories: ${calories}kcal`;

   // ✅ Bom (conversacional)
   return `Encontrei ${foodName}! Cada porção de 100g tem ${calories} calorias.`;
   ```

3. **Sempre citar fontes:**
   ```typescript
   return `${foodName} (fonte: USDA) contém ${protein}g de proteína por 100g`;
   ```

**Para API (Backend):**

1. **Use type hints sempre:**
   ```python
   # ❌ Ruim
   def calculate(a, b):
       return a + b

   # ✅ Bom
   def calculate(a: float, b: float) -> float:
       return a + b
   ```

2. **Validação com Pydantic:**
   ```python
   from pydantic import BaseModel, Field, field_validator

   class Request(BaseModel):
       quantity: float = Field(..., gt=0, description="Quantidade em gramas")

       @field_validator('quantity')
       @classmethod
       def validate_quantity(cls, v: float) -> float:
           if v > 10000:  # Limite razoável
               raise ValueError("Quantidade muito alta")
           return v
   ```

3. **Tratamento de erros consistente:**
   ```python
   try:
       result = service.operation()
   except ValueError as e:
       raise HTTPException(status_code=400, detail=str(e))
   except Exception as e:
       logger.error(f"Erro inesperado: {e}")
       raise HTTPException(status_code=500, detail="Erro interno")
   ```

### Cenários Comuns de Desenvolvimento

**Cenário 1: Adicionar novo filtro de busca**

*Contexto de negócio:* Usuários querem filtrar por "alimentos orgânicos"

*Solução técnica:*
1. Adicionar campo `is_organic: bool` ao modelo `Food`
2. Criar migração Alembic
3. Atualizar `FoodSearchFilters` schema
4. Modificar `FoodService.search_foods()` para aplicar filtro
5. Documentar no Swagger
6. Adicionar ao prompt do Agent

**Cenário 2: Implementar nova tool no Agent**

*Contexto de negócio:* Agent precisa sugerir substituições de alimentos

*Solução técnica:*
1. Criar endpoint `/api/foods/alternatives` na API
2. Implementar lógica usando busca semântica (similar nutrients + category)
3. Criar tool `suggest_alternatives` no Agent
4. Atualizar system prompt para mencionar a funcionalidade
5. Testar com exemplos reais

**Cenário 3: Otimizar performance de busca**

*Contexto de negócio:* Busca está lenta (>1s), usuários reclamam

*Solução técnica:*
1. Adicionar índices no PostgreSQL (EXPLAIN ANALYZE)
2. Implementar cache Redis para buscas frequentes
3. Usar busca híbrida (text + semantic) com pesos ajustáveis
4. Paginação eficiente (cursor-based)
5. Monitorar com métricas (Prometheus)

## Quando Usar Esta Skill

Use esta skill quando:
- ✅ Implementar novos endpoints na Catalog API
- ✅ Criar ou modificar tools do Agent
- ✅ Adicionar validações de negócio
- ✅ Resolver dúvidas sobre arquitetura
- ✅ Refatorar código existente
- ✅ Debugar problemas de integração Agent ↔ API

Não use para:
- ❌ Questões médicas ou de saúde
- ❌ Design de UI/UX
- ❌ Configuração de infraestrutura cloud
- ❌ Questões não relacionadas ao Nutria

## Exemplos de Prompts

**Bom uso:**
> "Preciso adicionar um endpoint para buscar alimentos por índice glicêmico. Como devo implementar considerando o padrão do Nutria?"

> "O Agent está retornando quantidades erradas. Como devo validar os cálculos nutricionais?"

> "Quero melhorar a busca semântica para entender sinônimos. Qual a melhor abordagem?"

**Uso inadequado:**
> "Como configurar Kubernetes?" (Fora do escopo)

> "Esta dieta é saudável para diabéticos?" (Questão médica)

## Recursos Adicionais

- **Documentação da API:** http://localhost:8000/docs
- **README:** `nutria-catalog/README.md`
- **Próximos Passos:** `proximos-passos-catalog-1.md`
- **Daily Report:** `daily.md`

## Versão

- **Criado em:** 27/12/2024
- **Versão:** 1.0.0
- **Mantenedor:** Time Nutria
