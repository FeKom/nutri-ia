# Tests - Nutria Catalog API

Este diretório contém os testes automatizados para a API Nutria Catalog.

## Configuração

### Instalar Dependências de Teste

```bash
pip install pytest pytest-asyncio httpx
```

## Executando os Testes

### Todos os testes

```bash
pytest tests/
```

### Testes específicos

```bash
# Apenas testes do tracking service
pytest tests/test_tracking_service.py -v

# Teste específico
pytest tests/test_tracking_service.py::TestLogMeal::test_log_meal_success -v
```

### Com cobertura

```bash
pip install pytest-cov
pytest tests/ --cov=app --cov-report=html
```

## Estrutura dos Testes

- `conftest.py` - Fixtures compartilhadas e configuração do pytest
- `test_tracking_service.py` - Testes do serviço de rastreamento de refeições

## Fixtures Disponíveis

### `session`
Sessão de banco de dados in-memory (SQLite) para testes isolados.

### `sample_food`
Alimento de exemplo (Peito de Frango) com informações nutricionais.

### `sample_user`
Perfil de usuário de exemplo para testes.

## Exemplos de Uso

```python
def test_exemplo(session: Session, sample_food, sample_user):
    # Arrange
    request = MealLogRequest(
        user_id=sample_user.user_id,
        meal_type=MealType.BREAKFAST,
        foods=[FoodLogItem(food_id=sample_food.id, quantity_g=150)]
    )

    # Act
    meal_log = tracking_service.log_meal(session, request)

    # Assert
    assert meal_log.total_calories > 0
```

## Boas Práticas

1. **Isolamento**: Cada teste deve ser independente
2. **Arrange-Act-Assert**: Organize os testes em 3 seções claras
3. **Fixtures**: Use fixtures para dados compartilhados
4. **Nomenclatura**: Use nomes descritivos (test_log_meal_success)
5. **Cobertura**: Busque pelo menos 80% de cobertura de código
