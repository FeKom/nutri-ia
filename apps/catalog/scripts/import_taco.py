#!/usr/bin/env python3
"""
Script para importar dados do TACO (Tabela Brasileira de Composição de Alimentos)
para o banco de dados do Nutria.

Requisitos:
    pip install pandas openpyxl sqlalchemy sentence-transformers psycopg2-binary

Uso:
    python scripts/import_taco.py --file taco_data.xlsx
    python scripts/import_taco.py --file taco_data.xlsx --dry-run  # Apenas visualiza
"""

import sys
import argparse
import pandas as pd
from pathlib import Path
from typing import List, Dict, Optional
from decimal import Decimal
from datetime import datetime
import re

# Adiciona o diretório raiz ao path para imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sentence_transformers import SentenceTransformer
import numpy as np

from app.models.food import Food, FoodNutrient, FoodSource
from app.core.config import settings


# Mapeamento de categorias TACO → categorias do banco
CATEGORY_MAPPING = {
    "Cereais e derivados": "grains",
    "Verduras, hortaliças e derivados": "vegetables",
    "Frutas e derivados": "fruits",
    "Gorduras e óleos": "fats",
    "Pescados e frutos do mar": "seafood",
    "Carnes e derivados": "meat",
    "Leite e derivados": "dairy",
    "Bebidas (alcoólicas e não alcoólicas)": "beverages",
    "Ovos e derivados": "eggs",
    "Produtos açucarados": "sweets",
    "Miscelâneas": "other",
    "Outros alimentos industrializados": "processed",
    "Alimentos preparados": "prepared",
    "Leguminosas e derivados": "legumes",
    "Nozes e sementes": "nuts",
}


def normalize_name(name: str) -> str:
    """
    Normaliza nome do alimento para busca case-insensitive.
    Remove acentos, converte para minúsculas.
    """
    import unicodedata
    # Remove acentos
    nfkd = unicodedata.normalize('NFKD', name)
    name_no_accents = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    # Lowercase e remove espaços extras
    return ' '.join(name_no_accents.lower().split())


def sanitize_decimal(value) -> Optional[Decimal]:
    """
    Converte valores para Decimal, tratando casos especiais.
    Retorna None para valores inválidos.
    """
    if pd.isna(value):
        return None

    try:
        # Se for string, limpa
        if isinstance(value, str):
            # Remove texto como "traço", "tr", "nd" (não detectado)
            if any(x in value.lower() for x in ["tr", "traço", "nd", "na", "-"]):
                return None
            # Remove caracteres não numéricos exceto . e ,
            value = re.sub(r'[^\d.,]', '', value)
            # Substitui vírgula por ponto
            value = value.replace(',', '.')

        decimal_value = Decimal(str(value))
        # Valida range (sem valores negativos)
        if decimal_value < 0:
            return None

        return round(decimal_value, 2)
    except:
        return None


def load_taco_excel(file_path: Path) -> pd.DataFrame:
    """
    Carrega arquivo Excel do TACO e retorna DataFrame limpo.

    Formato esperado do Excel TACO:
    - Coluna 'Descrição' ou 'Alimento': nome do alimento
    - Coluna 'Categoria': categoria do alimento
    - Coluna 'Energia (kcal)': calorias
    - Coluna 'Proteína (g)': proteína
    - Coluna 'Carboidrato (g)': carboidratos
    - Coluna 'Lipídeos (g)': gordura total
    - Etc.
    """
    print(f"📂 Carregando arquivo: {file_path}")

    # Tenta diferentes formatos de planilha
    try:
        # Primeiro tenta ler todas as sheets para encontrar a correta
        excel_file = pd.ExcelFile(file_path)
        print(f"   Sheets disponíveis: {excel_file.sheet_names}")

        # Geralmente a primeira sheet ou uma chamada "TACO"
        sheet_name = excel_file.sheet_names[0]
        if "TACO" in excel_file.sheet_names:
            sheet_name = "TACO"

        df = pd.read_excel(file_path, sheet_name=sheet_name)
        print(f"   Usando sheet: {sheet_name}")
        print(f"   Colunas encontradas: {list(df.columns)[:10]}...")

    except Exception as e:
        print(f"❌ Erro ao ler Excel: {e}")
        raise

    return df


def map_taco_to_food(row: pd.Series, category_mapping: Dict) -> Dict:
    """
    Mapeia uma linha do TACO para o modelo Food.

    Ajuste os nomes das colunas conforme seu arquivo Excel.
    """
    # Nome do alimento (ajuste conforme sua planilha)
    name = None
    for col in ['Descrição', 'Alimento', 'Nome', 'Descrição do Alimento']:
        if col in row.index:
            name = str(row[col]).strip()
            break

    if not name or name == 'nan':
        return None

    # Categoria (ajuste conforme sua planilha)
    category_raw = None
    for col in ['Categoria', 'Grupo', 'Grupo de Alimentos']:
        if col in row.index:
            category_raw = str(row[col])
            break

    category = category_mapping.get(category_raw, "other") if category_raw else "other"

    # Calorias
    calories = None
    for col in ['Energia (kcal)', 'Calorias', 'Energia']:
        if col in row.index:
            calories = sanitize_decimal(row[col])
            break

    return {
        'name': name,
        'name_normalized': normalize_name(name),
        'category': category,
        'serving_size_g': Decimal('100.00'),  # TACO usa 100g como padrão
        'serving_unit': 'g',
        'calorie_per_100g': calories,
        'source': FoodSource.TACO,
        'is_verified': True,  # TACO é fonte oficial
        'usda_id': None,
    }


def map_taco_to_nutrients(row: pd.Series) -> Dict:
    """
    Mapeia uma linha do TACO para FoodNutrient.
    Ajuste os nomes das colunas conforme seu arquivo Excel.
    """
    # Macronutrientes
    protein = None
    for col in ['Proteína (g)', 'Proteína', 'Proteinas']:
        if col in row.index:
            protein = sanitize_decimal(row[col])
            break

    carbs = None
    for col in ['Carboidrato (g)', 'Carboidratos', 'CHO']:
        if col in row.index:
            carbs = sanitize_decimal(row[col])
            break

    fat = None
    for col in ['Lipídeos (g)', 'Gorduras', 'Lipídeos', 'Lipideos']:
        if col in row.index:
            fat = sanitize_decimal(row[col])
            break

    # Calorias (para o campo calories_100g em FoodNutrient)
    calories = None
    for col in ['Energia (kcal)', 'Calorias', 'Energia']:
        if col in row.index:
            calories = sanitize_decimal(row[col])
            break

    # Detalhes de gordura
    saturated_fat = None
    for col in ['Gordura Saturada (g)', 'Saturada', 'AG saturados']:
        if col in row.index:
            saturated_fat = sanitize_decimal(row[col])
            break

    # Carboidratos detalhados
    fiber = None
    for col in ['Fibra Alimentar (g)', 'Fibra', 'Fibras']:
        if col in row.index:
            fiber = sanitize_decimal(row[col])
            break

    sugar = None
    for col in ['Açúcares (g)', 'Açúcar', 'Açucares']:
        if col in row.index:
            sugar = sanitize_decimal(row[col])
            break

    # Minerais
    sodium = None
    for col in ['Sódio (mg)', 'Sódio', 'Sodio']:
        if col in row.index:
            sodium = sanitize_decimal(row[col])
            break

    calcium = None
    for col in ['Cálcio (mg)', 'Cálcio', 'Calcio']:
        if col in row.index:
            calcium = sanitize_decimal(row[col])
            break

    iron = None
    for col in ['Ferro (mg)', 'Ferro']:
        if col in row.index:
            iron = sanitize_decimal(row[col])
            break

    # Vitaminas
    vitamin_c = None
    for col in ['Vitamina C (mg)', 'Vitamina C', 'Vit C']:
        if col in row.index:
            vitamin_c = sanitize_decimal(row[col])
            break

    return {
        'calories_100g': calories,
        'protein_g_100g': protein,
        'carbs_g_100g': carbs,
        'fat_g_100g': fat,
        'saturated_fat_g_100g': saturated_fat,
        'fiber_g_100g': fiber,
        'sugar_g_100g': sugar,
        'sodium_mg_100g': sodium,
        'calcium_mg_100g': calcium,
        'iron_mg_100g': iron,
        'vitamin_c_mg_100g': vitamin_c,
    }


def generate_embedding(text: str, model: SentenceTransformer) -> List[float]:
    """
    Gera embedding vetorial para busca semântica.
    Usa o mesmo modelo que o resto do sistema (all-MiniLM-L6-v2).
    """
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def import_taco_data(
    file_path: Path,
    db_url: str,
    dry_run: bool = False,
    batch_size: int = 50
):
    """
    Importa dados do TACO para o banco de dados.
    """
    print("🚀 Iniciando importação de dados do TACO\n")

    # 1. Carrega dados
    df = load_taco_excel(file_path)
    print(f"✅ Carregados {len(df)} registros do Excel\n")

    # Mostra preview dos dados
    print("📊 Preview dos dados:")
    print(df.head())
    print(f"\nColunas disponíveis: {list(df.columns)}\n")

    # 2. Carrega modelo de embedding
    print("🤖 Carregando modelo de embeddings (all-MiniLM-L6-v2)...")
    embedding_model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    print("✅ Modelo carregado\n")

    # 3. Conecta ao banco
    if not dry_run:
        print(f"🔌 Conectando ao banco: {db_url.split('@')[1] if '@' in db_url else db_url}")
        engine = create_engine(db_url)
        session = Session(engine)
    else:
        print("🔍 Modo DRY-RUN ativado (não salvará no banco)\n")
        session = None

    # 4. Processa dados
    imported_count = 0
    skipped_count = 0
    error_count = 0

    print("📥 Processando alimentos...\n")

    for idx, row in df.iterrows():
        try:
            # Mapeia dados
            food_data = map_taco_to_food(row, CATEGORY_MAPPING)

            if not food_data:
                skipped_count += 1
                continue

            nutrient_data = map_taco_to_nutrients(row)

            # Gera embedding
            embedding = generate_embedding(food_data['name'], embedding_model)
            food_data['embedding'] = embedding

            # Preview
            if dry_run or (imported_count < 5):
                print(f"{'[DRY-RUN] ' if dry_run else ''}Alimento #{idx + 1}:")
                print(f"  Nome: {food_data['name']}")
                print(f"  Categoria: {food_data['category']}")
                print(f"  Calorias: {nutrient_data.get('calories_100g', 'N/A')} kcal/100g")
                print(f"  Proteína: {nutrient_data.get('protein_g_100g', 'N/A')}g")
                print(f"  Carbos: {nutrient_data.get('carbs_g_100g', 'N/A')}g")
                print(f"  Gordura: {nutrient_data.get('fat_g_100g', 'N/A')}g")
                print(f"  Embedding: {len(embedding)} dimensões")
                print()

            # Salva no banco
            if not dry_run:
                # Verifica se já existe (por nome normalizado)
                existing = session.query(Food).filter(
                    Food.name_normalized == food_data['name_normalized']
                ).first()

                if existing:
                    print(f"⚠️  Alimento já existe: {food_data['name']} (pulando)")
                    skipped_count += 1
                    continue

                # Cria Food
                food = Food(**food_data)
                session.add(food)
                session.flush()  # Para obter o food.id

                # Cria FoodNutrient
                nutrient_data['food_id'] = food.id
                nutrient = FoodNutrient(**nutrient_data)
                session.add(nutrient)

                # Commit a cada batch
                if (imported_count + 1) % batch_size == 0:
                    session.commit()
                    print(f"💾 Salvos {imported_count + 1} alimentos...")

            imported_count += 1

        except Exception as e:
            print(f"❌ Erro ao processar linha {idx}: {e}")
            error_count += 1
            if not dry_run and session:
                session.rollback()
            continue

    # Commit final
    if not dry_run and session:
        session.commit()
        session.close()

    # Relatório final
    print("\n" + "="*60)
    print("📊 RELATÓRIO DE IMPORTAÇÃO")
    print("="*60)
    print(f"✅ Importados: {imported_count}")
    print(f"⚠️  Pulados: {skipped_count}")
    print(f"❌ Erros: {error_count}")
    print(f"📁 Total no arquivo: {len(df)}")
    print("="*60)

    if dry_run:
        print("\n💡 Execute novamente sem --dry-run para salvar no banco")
    else:
        print("\n🎉 Importação concluída com sucesso!")


def main():
    parser = argparse.ArgumentParser(
        description="Importa dados do TACO para o banco de dados Nutria"
    )
    parser.add_argument(
        '--file',
        type=Path,
        required=True,
        help='Caminho para o arquivo Excel do TACO'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Apenas visualiza os dados sem salvar no banco'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Tamanho do batch para commits (padrão: 50)'
    )
    parser.add_argument(
        '--db-url',
        type=str,
        default=None,
        help='URL do banco (padrão: usa DATABASE_URL do .env)'
    )

    args = parser.parse_args()

    # Valida arquivo
    if not args.file.exists():
        print(f"❌ Arquivo não encontrado: {args.file}")
        sys.exit(1)

    # URL do banco
    db_url = args.db_url or settings.DATABASE_URL
    if not db_url:
        print("❌ DATABASE_URL não configurada. Use --db-url ou configure .env")
        sys.exit(1)

    # Executa importação
    try:
        import_taco_data(
            file_path=args.file,
            db_url=db_url,
            dry_run=args.dry_run,
            batch_size=args.batch_size
        )
    except KeyboardInterrupt:
        print("\n\n⚠️  Importação cancelada pelo usuário")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erro fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
