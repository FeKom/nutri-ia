# Como usar Line Profiler

O `line_profiler` foi adicionado para identificar bottlenecks de performance no código.

## Instalação

```bash
pip install line_profiler
```

## Uso

### Profiling do script generate_embeddings.py

Para rodar com profiling linha por linha:

```bash
# Gera o arquivo .lprof com os dados de profiling
kernprof -l -v scripts/generate_embeddings.py

# Ou apenas gerar o arquivo sem mostrar output
kernprof -l scripts/generate_embeddings.py

# Ver o resultado depois
python -m line_profiler scripts/generate_embeddings.py.lprof
```

### Output Exemplo

O profiler mostrará algo assim:

```
Timer unit: 1e-06 s

Total time: 0.123456 s
File: scripts/generate_embeddings.py
Function: generate_all_embeddings at line 15

Line #      Hits         Time  Per Hit   % Time  Line Contents
==============================================================
    15                                           @profile
    16                                           def generate_all_embeddings():
    17         1         12.0     12.0      0.0      with Session(engine) as session:
    18         1        234.0    234.0      0.2          statement = (...)
    19         1      45678.0  45678.0     37.0          results = session.exec(statement).all()
    20       324      78900.0    243.5     63.9          for food, nutrients in results:
    ...
```

### Funções com @profile

As seguintes funções estão sendo perfiladas:

- `generate_all_embeddings()` em `scripts/generate_embeddings.py`
- `generate_embedding()` em `app/services/embedding_service.py`
- `generate_food_description()` em `app/services/embedding_service.py`
- `generate_food_embedding()` em `app/services/embedding_service.py`

## Rodando sem profiler

O código funciona normalmente sem o profiler. Se você rodar:

```bash
python3 scripts/generate_embeddings.py
```

O decorator `@profile` será ignorado e o código executará normalmente.
