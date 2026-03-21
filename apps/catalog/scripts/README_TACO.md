# Guia de Importação de Dados do TACO

## O que é o TACO?

A **Tabela Brasileira de Composição de Alimentos (TACO)** é mantida pela UNICAMP e disponibilizada **GRATUITAMENTE** pelo governo brasileiro.

- 📦 **~600 alimentos brasileiros** com composição nutricional completa
- 🇧🇷 **Nomes em português** (perfeito para complementar o USDA em inglês)
- ✅ **Gratuito e oficial** (fonte confiável)
- 📊 **Mesma estrutura do USDA** (nutrientes por 100g)

---

## Como Baixar os Dados do TACO

### Opção 1: PDF Oficial (Converter para Excel)
1. Acesse: https://www.cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf
2. Use ferramentas como Tabula (https://tabula.technology/) para extrair tabelas para CSV/Excel

### Opção 2: Excel Já Pronto (Recomendado)
Busque por "TACO excel" ou "TACO planilha" - há várias versões disponíveis:
- NEPA/UNICAMP: https://www.nepa.unicamp.br/taco/
- GitHub: Comunidade mantém versões em CSV/Excel

### Opção 3: API (Se disponível)
Algumas instituições disponibilizam APIs REST com dados do TACO.

---

## Instalação de Dependências

```bash
cd /Users/vinic/company/nutria-catalog

# Instala as bibliotecas necessárias
pip install pandas openpyxl sentence-transformers psycopg2-binary
```

---

## Uso do Script

### 1. Teste Inicial (Dry-Run)

Antes de importar, **sempre faça um dry-run** para verificar se os dados estão corretos:

```bash
python scripts/import_taco.py --file /caminho/para/taco_data.xlsx --dry-run
```

**O que o dry-run faz:**
- ✅ Carrega o Excel e mostra as colunas encontradas
- ✅ Processa os dados e mostra preview dos primeiros 5 alimentos
- ✅ Valida nutrientes e embeddings
- ❌ **NÃO salva no banco** (seguro para testes)

**Saída esperada:**
```
📂 Carregando arquivo: taco_data.xlsx
   Sheets disponíveis: ['TACO', 'Metadados']
   Usando sheet: TACO
   Colunas encontradas: ['Descrição', 'Categoria', 'Energia (kcal)', ...]

🤖 Carregando modelo de embeddings (all-MiniLM-L6-v2)...
✅ Modelo carregado

🔍 Modo DRY-RUN ativado (não salvará no banco)

📥 Processando alimentos...

[DRY-RUN] Alimento #1:
  Nome: Arroz integral cozido
  Categoria: grains
  Calorias: 124 kcal/100g
  Proteína: 2.6g
  Carbos: 25.8g
  Gordura: 1.0g
  Embedding: 384 dimensões

[DRY-RUN] Alimento #2:
  Nome: Feijão preto cozido
  Categoria: legumes
  Calorias: 77 kcal/100g
  ...
```

---

### 2. Importação Real

Se o dry-run estiver OK, execute sem a flag `--dry-run`:

```bash
python scripts/import_taco.py --file /caminho/para/taco_data.xlsx
```

**O script vai:**
1. ✅ Carregar o Excel
2. ✅ Gerar embeddings para cada alimento (vetores de 384 dimensões)
3. ✅ Validar e sanitizar nutrientes
4. ✅ Salvar no banco (batches de 50 alimentos)
5. ✅ Pular alimentos duplicados (por nome normalizado)

**Saída esperada:**
```
🚀 Iniciando importação de dados do TACO

📂 Carregando arquivo: taco_data.xlsx
✅ Carregados 597 registros do Excel

🤖 Carregando modelo de embeddings...
✅ Modelo carregado

🔌 Conectando ao banco: localhost/nutria_db

📥 Processando alimentos...

Alimento #1:
  Nome: Arroz integral cozido
  Categoria: grains
  ...

💾 Salvos 50 alimentos...
💾 Salvos 100 alimentos...
...
💾 Salvos 597 alimentos...

============================================================
📊 RELATÓRIO DE IMPORTAÇÃO
============================================================
✅ Importados: 580
⚠️  Pulados: 15 (duplicados)
❌ Erros: 2
📁 Total no arquivo: 597
============================================================

🎉 Importação concluída com sucesso!
```

---

### 3. Opções Avançadas

```bash
# Usar outro banco (não o padrão do .env)
python scripts/import_taco.py \
  --file taco_data.xlsx \
  --db-url "postgresql://user:pass@localhost/outro_banco"

# Ajustar tamanho do batch (padrão: 50)
python scripts/import_taco.py \
  --file taco_data.xlsx \
  --batch-size 100
```

---

## Formato Esperado do Excel

O script tenta encontrar automaticamente as colunas, mas o Excel deve ter:

### Colunas Obrigatórias:
- **Nome do Alimento**: `Descrição` ou `Alimento` ou `Nome`
- **Categoria**: `Categoria` ou `Grupo` ou `Grupo de Alimentos`

### Colunas de Nutrientes (opcionais, mas recomendadas):
- `Energia (kcal)` - Calorias
- `Proteína (g)` - Proteína
- `Carboidrato (g)` - Carboidratos
- `Lipídeos (g)` - Gordura total
- `Fibra Alimentar (g)` - Fibra
- `Sódio (mg)` - Sódio
- `Cálcio (mg)` - Cálcio
- `Ferro (mg)` - Ferro
- `Vitamina C (mg)` - Vitamina C

**Exemplo de estrutura:**

| Descrição | Categoria | Energia (kcal) | Proteína (g) | Carboidrato (g) | Lipídeos (g) |
|-----------|-----------|----------------|--------------|-----------------|--------------|
| Arroz integral cozido | Cereais e derivados | 124 | 2.6 | 25.8 | 1.0 |
| Feijão preto cozido | Leguminosas e derivados | 77 | 4.5 | 14.0 | 0.5 |
| Banana prata | Frutas e derivados | 98 | 1.3 | 26.0 | 0.1 |

---

## Personalização do Script

Se as colunas do seu Excel forem diferentes, edite o script:

### 1. Ajustar Mapeamento de Colunas

Em `import_taco.py`, linha ~190 (função `map_taco_to_food`):

```python
# ANTES (padrão)
for col in ['Descrição', 'Alimento', 'Nome']:
    if col in row.index:
        name = str(row[col]).strip()
        break

# DEPOIS (seu Excel)
for col in ['Nome do Alimento', 'Food Name', 'Descrição']:
    if col in row.index:
        name = str(row[col]).strip()
        break
```

### 2. Ajustar Categorias

Em `import_taco.py`, linhas 32-48 (`CATEGORY_MAPPING`):

```python
CATEGORY_MAPPING = {
    "Cereais e derivados": "grains",
    "Suas Categorias Aqui": "sua_categoria_aqui",
    # ...
}
```

---

## Verificação Pós-Importação

### 1. Confira no Banco

```sql
-- Total de alimentos do TACO
SELECT COUNT(*) FROM foods WHERE source = 'TACO';

-- Amostra de alimentos
SELECT name, category, calorie_per_100g
FROM foods
WHERE source = 'TACO'
LIMIT 10;

-- Verifica embeddings
SELECT name, array_length(embedding, 1) as dim
FROM foods
WHERE source = 'TACO' AND embedding IS NOT NULL
LIMIT 5;
```

### 2. Teste no Agent

```bash
# Teste no frontend
POST /api/chat
{
  "messages": [
    { "role": "user", "content": "Busque informações nutricionais de feijão preto" }
  ]
}

# Esperado:
# - Agent encontra "Feijão preto cozido" do TACO
# - Retorna calorias, proteínas, etc.
```

### 3. Teste Busca Vetorial (Português)

```sql
-- Gera embedding para "arroz" e busca similares
WITH query_embedding AS (
  SELECT embedding FROM foods
  WHERE name ILIKE '%arroz integral%'
  LIMIT 1
)
SELECT name, source,
       1 - (embedding <=> (SELECT embedding FROM query_embedding)) AS similarity
FROM foods
ORDER BY similarity DESC
LIMIT 10;
```

---

## Troubleshooting

### Erro: "ModuleNotFoundError: No module named 'sentence_transformers'"

```bash
pip install sentence-transformers
```

### Erro: "Could not find column 'Descrição'"

Seu Excel usa nomes de colunas diferentes. Edite o script conforme seção "Personalização".

### Erro: "duplicate key value violates unique constraint"

Alimento já existe no banco (nome normalizado duplicado). O script pula automaticamente.

### Embeddings estão NULL

Verifique se o modelo `all-MiniLM-L6-v2` foi baixado corretamente:

```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
embedding = model.encode("teste")
print(f"Embedding gerado: {len(embedding)} dimensões")  # Deve ser 384
```

---

## Próximos Passos

1. ✅ **Importe TACO** - Use este script
2. ✅ **Teste busca** - Verifique se alimentos em português são encontrados
3. 🔄 **Atualize instruções do agent** - Já está configurado para traduzir PT→EN, mas agora também buscará em PT diretamente
4. 🎯 **Combine USDA + TACO** - Agora você tem ~900 alimentos (324 USDA + ~600 TACO)

---

## Diferenças USDA vs TACO

| Aspecto | USDA | TACO |
|---------|------|------|
| **Idioma** | Inglês | Português |
| **Alimentos** | ~324 (sua base) | ~600 |
| **Fonte** | USDA FoodData Central | NEPA/UNICAMP |
| **Foco** | Alimentos americanos | Alimentos brasileiros |
| **Exemplos** | "grilled chicken", "white rice" | "frango grelhado", "arroz branco" |

**Vantagem de ter ambos:**
- Busca em inglês: encontra USDA
- Busca em português: encontra TACO
- Busca vetorial: encontra similares em ambos

---

## Recursos

- 📚 TACO Oficial: https://www.nepa.unicamp.br/taco/
- 🔬 USDA FoodData: https://fdc.nal.usda.gov/
- 🤖 Sentence Transformers: https://www.sbert.net/
- 📊 Pandas Docs: https://pandas.pydata.org/
