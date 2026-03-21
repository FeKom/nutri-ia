# Quick Start Guide

Este guia rápido vai te ajudar a colocar a API rodando em menos de 5 minutos.

## Pré-requisitos

- Python 3.11
- Docker e Docker Compose instalados

## Passos

### 1. Configure o Python (escolha uma opção)

**Opção A - Com asdf (recomendado):**
```bash
asdf install python 3.11.7
```

**Opção B - Com pyenv:**
```bash
pyenv install 3.11.7
pyenv local 3.11.7
```

### 2. Crie o ambiente virtual e instale dependências

```bash
python -m venv venv
source venv/bin/activate  # No Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite .env se necessário (valores padrão funcionam para desenvolvimento)
```

### 4. Inicie o banco de dados

```bash
docker-compose up -d
```

Aguarde alguns segundos para o PostgreSQL inicializar.

### 5. Execute as migrações

```bash
alembic upgrade head
```

### 6. (Opcional) Adicione dados de exemplo

```bash
python seed_data.py
```

### 7. Inicie a API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Pronto!

- API: http://localhost:8000
- Documentação Interativa: http://localhost:8000/docs
- Documentação ReDoc: http://localhost:8000/redoc

## Usando o Makefile (atalho)

Se você preferir, pode usar o Makefile para facilitar:

```bash
# Iniciar tudo de uma vez (docker + migrações + servidor)
make dev

# Ou por partes:
make install      # Instalar dependências
make docker-up    # Iniciar Docker
make migrate      # Executar migrações
make run          # Iniciar servidor
```

## Testando a API

### 1. Buscar alimentos

```bash
curl -X POST "http://localhost:8000/api/foods/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "chicken",
    "limit": 5
  }'
```

### 2. Calcular nutrição

```bash
# Primeiro, pegue um food_id da busca acima, depois:
curl -X POST "http://localhost:8000/api/nutrition/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "foods": [
      {
        "food_id": "SEU_FOOD_ID_AQUI",
        "quantity": 150
      }
    ]
  }'
```

## Problemas?

### PostgreSQL não inicia
```bash
docker-compose logs postgres
docker-compose restart postgres
```

### Erro de migração
```bash
# Resetar banco de dados (CUIDADO: apaga dados)
make reset-db
```

### Porta 8000 já está em uso
```bash
# Use outra porta
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Próximos Passos

1. Veja o [README.md](README.md) completo para mais detalhes
2. Explore a documentação em http://localhost:8000/docs
3. Adicione seus próprios dados de alimentos
4. Integre com seu agente AI (Mastra.ai)

## Comandos Úteis

```bash
# Parar containers
docker-compose down

# Ver logs
docker-compose logs -f

# Acessar PostgreSQL
docker-compose exec postgres psql -U nutriauser -d nutriadb

# Limpar cache Python
make clean
```
