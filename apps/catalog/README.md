# Nutria Food Catalog API

[![Tests](https://img.shields.io/badge/tests-53%20passed-brightgreen)](./tests)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)]()
[![Python](https://img.shields.io/badge/python-3.11-blue)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-teal)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)

Uma API completa de banco de dados de alimentos e nutrição construída com FastAPI e PostgreSQL com pgvector. Projetada para ser consumida por agentes de IA (Mastra.ai) para assistência nutricional.

## ✨ Funcionalidades

- **Busca de Alimentos**: Busca textual com múltiplos filtros (categoria, nutrientes, fonte, status de verificação)
- **Cálculos Nutricionais**: Calcula valores nutricionais totais para combinações de alimentos
- **Recomendações Personalizadas**: Sistema inteligente que respeita restrições alimentares, alergias e preferências
- **Rastreamento de Refeições**: Registre refeições e acompanhe progresso nutricional diário/semanal
- **Estatísticas e Analytics**: Resumos diários, médias semanais e taxa de aderência
- **Dados Multi-fonte**: Suporte para bases de dados USDA, TACO e customizadas
- **Busca Semântica**: Infraestrutura preparada para busca semântica baseada em pgvector
- **OpenAPI/Swagger**: Documentação completa da API disponível em `/docs`
- **Totalmente Testado**: 53 testes automatizados com 100% de cobertura dos serviços principais

## Stack Tecnológica

- **Python 3.11** (gerenciado via asdf ou pyenv)
- **FastAPI** - Framework web moderno e rápido
- **SQLModel** - ORM de banco de dados SQL com integração Pydantic
- **PostgreSQL 15+** com extensão **pgvector**
- **Docker & Docker Compose** - Desenvolvimento containerizado
- **Alembic** - Migrações de banco de dados

## Estrutura do Projeto

```
nutria-catalog/
├── app/
│   ├── __init__.py
│   ├── main.py                      # App FastAPI e configuração Swagger
│   ├── models/
│   │   ├── __init__.py
│   │   ├── base.py                  # Modelos base com mixins
│   │   ├── food.py                  # Modelos Food e FoodNutrient
│   │   ├── user.py                  # UserProfile, MealPlan
│   │   └── tracking.py              # MealLog, DailyStats
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py                # Schemas comuns (paginação, etc)
│   │   ├── food.py                  # Schemas de alimentos
│   │   ├── recommendation.py        # Schemas de recomendações
│   │   └── tracking.py              # Schemas de tracking
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py          # Dependências do FastAPI
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── foods.py             # Endpoints de busca de alimentos
│   │       ├── nutrition.py         # Endpoints de cálculo nutricional
│   │       ├── recommendations.py   # Endpoints de recomendações
│   │       └── tracking.py          # Endpoints de rastreamento
│   ├── services/
│   │   ├── __init__.py
│   │   ├── food_service.py          # Lógica de negócio de alimentos
│   │   ├── nutrition_service.py     # Cálculos nutricionais
│   │   ├── recomendation_service.py # Recomendações personalizadas
│   │   ├── tracking_service.py      # Rastreamento de refeições
│   │   ├── embedding_service.py     # Geração de embeddings
│   │   └── food_analysis_service.py # Análise de imagens
│   └── core/
│       ├── config.py                # Gerenciamento de configurações
│       └── database.py              # Conexão com banco de dados
├── alembic/                         # Migrações de banco de dados
│   ├── versions/
│   │   ├── 001-initial_migration.py
│   │   └── bd1e66bb991d-add_tracking_tables.py
│   └── env.py
├── tests/                           # ⭐ Suite de testes (53 testes)
│   ├── __init__.py
│   ├── conftest.py                  # Fixtures compartilhadas
│   ├── test_api_endpoints.py        # Testes de integração
│   ├── test_food_service.py         # Testes food service
│   ├── test_nutrition_service.py    # Testes nutrition service
│   ├── test_recommendation_service.py # Testes recommendations
│   ├── test_tracking_service.py     # Testes tracking
│   └── README.md                    # Guia de testes
├── docs/
│   ├── TRACKING_SYSTEM.md           # Documentação completa do tracking
│   ├── TRACKING_QUICKSTART.md       # Guia rápido de início
│   └── tech/
│       └── backend-sprint-1.md      # Roadmap técnico
├── docker/
│   └── init.sql                     # Inicialização do PostgreSQL
├── docker-compose.yml
├── Makefile                         # Atalhos para comandos comuns
├── requirements.txt
├── .env.example
└── README.md
```

## Instruções de Instalação

### Pré-requisitos

- Python 3.11
- Docker e Docker Compose
- asdf ou pyenv (recomendado para gerenciamento de versão do Python)

### Opção 1: Instalação com asdf (Recomendado)

1. **Instalar asdf** (se ainda não estiver instalado):
   ```bash
   git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0
   echo '. "$HOME/.asdf/asdf.sh"' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **Instalar Python 3.11 com asdf**:
   ```bash
   asdf plugin add python
   asdf install python 3.11.7
   asdf local python 3.11.7
   ```

3. **Verificar versão do Python**:
   ```bash
   python --version  # Deve mostrar Python 3.11.7
   ```

### Opção 2: Instalação com pyenv

1. **Instalar pyenv** (se ainda não estiver instalado):
   ```bash
   curl https://pyenv.run | bash
   ```

2. **Instalar Python 3.11**:
   ```bash
   pyenv install 3.11.7
   pyenv local 3.11.7
   ```

3. **Verificar versão do Python**:
   ```bash
   python --version  # Deve mostrar Python 3.11.7
   ```

### Instalação Rápida com Makefile

Se você já tem Python 3.11 e Docker instalados, use estes comandos:

```bash
# 1. Instalar dependências Python
make install

# 2. Iniciar tudo (Docker + Migrações + Servidor)
make dev
```

Pronto! A API estará rodando em http://localhost:8000

### Instalação Manual (Passo a Passo)

1. **Navegar até o diretório do projeto**:
   ```bash
   cd nutria-catalog
   ```

2. **Criar e ativar ambiente virtual**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # No Windows: venv\Scripts\activate
   ```

3. **Instalar dependências**:
   ```bash
   pip install -r requirements.txt
   # OU use: make install
   ```

4. **Configurar variáveis de ambiente**:
   ```bash
   cp .env.example .env
   # Edite .env se precisar alterar as credenciais do banco
   ```

5. **Iniciar PostgreSQL com Docker**:
   ```bash
   docker-compose up -d
   # OU use: make docker-up
   ```

6. **Aguardar PostgreSQL estar pronto**:
   ```bash
   docker-compose logs -f postgres
   # Aguarde até ver "database system is ready to accept connections"
   # Pressione Ctrl+C para sair dos logs
   ```

7. **Executar migrações do banco de dados**:
   ```bash
   alembic upgrade head
   # OU use: make migrate
   ```

8. **(Opcional) Adicionar dados de exemplo**:
   ```bash
   python seed_data.py
   ```

9. **Iniciar o servidor da API**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   # OU use: make run
   ```

10. **Acessar a API**:
    - API: http://localhost:8000
    - Documentação Swagger: http://localhost:8000/docs
    - Documentação ReDoc: http://localhost:8000/redoc

## Comandos do Makefile

O Makefile fornece atalhos convenientes para tarefas comuns:

```bash
make help         # Mostra todos os comandos disponíveis
make install      # Instala dependências Python
make docker-up    # Inicia containers Docker
make docker-down  # Para containers Docker
make migrate      # Executa migrações do banco
make run          # Inicia o servidor da API
make dev          # Inicia tudo (docker + migrações + servidor)
make clean        # Limpa arquivos cache do Python
make reset-db     # Reseta banco de dados (CUIDADO: apaga dados)
```

## 📚 Documentação

- **[TRACKING_SYSTEM.md](docs/TRACKING_SYSTEM.md)** - Documentação completa do sistema de rastreamento
- **[TRACKING_QUICKSTART.md](docs/TRACKING_QUICKSTART.md)** - Guia rápido para começar
- **[Tests README](tests/README.md)** - Guia de execução de testes
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🔗 Endpoints da API

### Health Check

- `GET /` - Informações da API
- `GET /health` - Verificação de saúde

### 🍎 Busca de Alimentos

**POST /api/v1/foods/search**

Buscar itens de alimentos com queries de texto e filtros opcionais.

**Corpo da Requisição:**
```json
{
  "query": "peito de frango",
  "limit": 10,
  "filters": {
    "category": "protein",
    "min_protein": 20,
    "max_calories": 200,
    "source": "usda",
    "verified_only": true
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "foods": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Peito de Frango, Sem Pele",
      "category": "protein",
      "serving_size_g": 100,
      "serving_unit": "g",
      "calorie_per_100g": 165,
      "source": "usda",
      "is_verified": true,
      "protein_g_100g": 31,
      "carbs_g_100g": 0,
      "fat_g_100g": 3.6
    }
  ],
  "count": 1
}
```

### 🧮 Cálculo Nutricional

**POST /api/v1/nutrition/calculate**

Calcular valores nutricionais totais para uma combinação de alimentos.

**Corpo da Requisição:**
```json
{
  "foods": [
    {
      "food_id": "550e8400-e29b-41d4-a716-446655440000",
      "quantity": 150
    },
    {
      "food_id": "550e8400-e29b-41d4-a716-446655440001",
      "quantity": 100
    }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "total": {
    "calories": 350.5,
    "protein_g": 45.2,
    "carbs_g": 12.5,
    "fat_g": 8.3,
    "saturated_fat_g": 2.1,
    "fiber_g": 2.5,
    "sugar_g": 1.2,
    "sodium_mg": 150,
    "calcium_mg": 50,
    "iron_mg": 2.5,
    "vitamin_c_mg": 10
  },
  "details": [
    {
      "food_id": "550e8400-e29b-41d4-a716-446655440000",
      "food_name": "Peito de Frango",
      "quantity_g": 150,
      "calories": 247.5,
      "protein_g": 46.5,
      "carbs_g": 0,
      "fat_g": 5.4
    }
  ]
}
```

### 💡 Recomendações Personalizadas

**POST /api/v1/recommendations/**

Obter recomendações de alimentos baseadas em restrições alimentares, alergias e preferências do usuário.

**Corpo da Requisição:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 20
}
```

**Resposta:** Lista de alimentos filtrados que atendem às restrições do usuário.

### 📊 Rastreamento de Refeições

**POST /api/v1/tracking/meals/log**

Registrar uma refeição consumida.

**Corpo da Requisição:**
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "meal_type": "breakfast",
  "foods": [
    {
      "food_id": "650e8400-e29b-41d4-a716-446655440001",
      "quantity_g": 50,
      "name": "Aveia"
    }
  ],
  "notes": "Café da manhã pós-treino"
}
```

**GET /api/v1/tracking/summary/daily**

Obter resumo nutricional do dia com progresso vs metas.

**Query Parameters:**
- `user_id`: UUID do usuário
- `date`: Data (YYYY-MM-DD), padrão: hoje

**GET /api/v1/tracking/stats/weekly**

Estatísticas semanais com médias e taxa de aderência.

**Query Parameters:**
- `user_id`: UUID do usuário
- `days`: Número de dias (1-30), padrão: 7

Ver [documentação completa](docs/TRACKING_SYSTEM.md) para mais detalhes.

## 🗄️ Schema do Banco de Dados

### Tabela Foods (Alimentos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| name | VARCHAR(255) | Nome do alimento |
| name_normalized | VARCHAR(255) | Nome normalizado para busca |
| category | VARCHAR(50) | Categoria do alimento |
| serving_size_g | DECIMAL | Tamanho da porção padrão em gramas |
| serving_unit | VARCHAR(20) | Unidade de medida |
| calorie_per_100g | DECIMAL | Calorias por 100g |
| usda_id | VARCHAR(50) | ID do USDA FoodData Central |
| source | ENUM | Fonte dos dados (usda, taco, custom) |
| is_verified | BOOLEAN | Status de verificação |
| embedding | VECTOR(384) | Embedding vetorial para busca semântica |
| created_at | TIMESTAMP | Timestamp de criação |
| updated_at | TIMESTAMP | Timestamp de atualização |

### Tabela Food Nutrients (Nutrientes dos Alimentos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID | Chave primária |
| food_id | UUID | Chave estrangeira para foods |
| calories_100g | DECIMAL | Calorias por 100g |
| protein_g_100g | DECIMAL | Proteína em gramas por 100g |
| carbs_g_100g | DECIMAL | Carboidratos em gramas por 100g |
| fat_g_100g | DECIMAL | Gordura em gramas por 100g |
| saturated_fat_g_100g | DECIMAL | Gordura saturada em gramas por 100g |
| fiber_g_100g | DECIMAL | Fibra em gramas por 100g |
| sugar_g_100g | DECIMAL | Açúcar em gramas por 100g |
| sodium_mg_100g | DECIMAL | Sódio em miligramas por 100g |
| calcium_mg_100g | DECIMAL | Cálcio em miligramas por 100g |
| iron_mg_100g | DECIMAL | Ferro em miligramas por 100g |
| vitamin_c_mg_100g | DECIMAL | Vitamina C em miligramas por 100g |
| created_at | TIMESTAMP | Timestamp de criação |
| updated_at | TIMESTAMP | Timestamp de atualização |

### Tabelas de Rastreamento

**user_profiles** - Perfis de usuários com preferências e metas
**meal_plans** - Planos alimentares gerados
**meal_logs** - Registros de refeições consumidas
**daily_stats** - Estatísticas diárias agregadas

Ver [schema completo](docs/TRACKING_SYSTEM.md#modelos-de-dados) na documentação.

## 🗃️ Migrações de Banco de Dados

### Criar uma nova migração

```bash
alembic revision --autogenerate -m "descrição das alterações"
```

### Aplicar migrações

```bash
alembic upgrade head
# OU use: make migrate
```

### Reverter migração

```bash
alembic downgrade -1
```

### Ver histórico de migrações

```bash
alembic history
```

## 🧪 Testes

O projeto possui uma suite completa de testes automatizados com **53 testes** cobrindo todos os serviços principais.

### Executar todos os testes

```bash
pytest tests/ -v
```

### Executar testes específicos

```bash
# Testes de um serviço específico
pytest tests/test_tracking_service.py -v
pytest tests/test_nutrition_service.py -v

# Testes de integração da API
pytest tests/test_api_endpoints.py -v
```

### Cobertura de testes

```bash
# Instalar pytest-cov
pip install pytest-cov

# Executar com cobertura
pytest tests/ --cov=app --cov-report=html --cov-report=term

# Ver relatório HTML
open htmlcov/index.html
```

### Estatísticas de Testes

- ✅ **53 testes** passando (100%)
- ✅ **API Endpoints**: 12 testes de integração
- ✅ **Food Service**: 12 testes
- ✅ **Nutrition Service**: 7 testes
- ✅ **Recommendation Service**: 11 testes
- ✅ **Tracking Service**: 11 testes

Ver [guia completo de testes](tests/README.md) para mais informações.

## 💻 Desenvolvimento

### Formatação de código

```bash
# Instalar ferramentas de formatação
pip install black isort

# Formatar código
black app/
isort app/
```

### Verificação de tipos

```bash
# Instalar mypy
pip install mypy

# Executar verificação de tipos
mypy app/
```

## Comandos Docker

### Iniciar serviços

```bash
docker-compose up -d
# OU use: make docker-up
```

### Parar serviços

```bash
docker-compose down
# OU use: make docker-down
```

### Ver logs

```bash
docker-compose logs -f
```

### Reiniciar PostgreSQL

```bash
docker-compose restart postgres
```

### Acessar CLI do PostgreSQL

```bash
docker-compose exec postgres psql -U nutriauser -d nutriadb
```

## Solução de Problemas

### Problemas de conexão com PostgreSQL

1. Verificar se o Docker está rodando:
   ```bash
   docker ps
   ```

2. Verificar logs do PostgreSQL:
   ```bash
   docker-compose logs postgres
   ```

3. Verificar se o PostgreSQL está saudável:
   ```bash
   docker-compose exec postgres pg_isready -U nutriauser
   ```

### Problemas com migrações

1. Verificar status atual da migração:
   ```bash
   alembic current
   ```

2. Resetar banco de dados (ATENÇÃO: Isso irá deletar todos os dados):
   ```bash
   docker-compose down -v
   docker-compose up -d
   alembic upgrade head
   # OU use: make reset-db
   ```

### Erros de importação

Certifique-se de estar no ambiente virtual e que todas as dependências estão instaladas:
```bash
source venv/bin/activate
pip install -r requirements.txt
# OU use: make install
```

## 🚀 Melhorias Futuras

### Em Desenvolvimento
- Busca semântica usando pgvector e sentence-transformers
- Geração de embeddings para descrições de alimentos
- Busca híbrida combinando texto e busca semântica

### Roadmap
- Autenticação e autorização (JWT)
- Rate limiting e throttling
- Camada de cache (Redis)
- Scripts de importação de dados para bases USDA e TACO
- Análise de imagens de alimentos (DETIC)
- Pipeline de CI/CD
- Métricas e monitoramento (Prometheus + Grafana)
- Webhooks para integração com apps externos

## Licença

[Adicione sua licença aqui]

## Contribuindo

[Adicione diretrizes de contribuição aqui]

## Contato

[Adicione informações de contato aqui]
