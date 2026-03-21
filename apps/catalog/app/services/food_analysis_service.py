"""
Food Analysis Service - Detecção de alimentos em imagens usando DETIC + busca vetorial

DETIC (Detecting Twenty-thousand Classes) oferece:
- Open-vocabulary detection (21,000+ categorias)
- Baseado em CLIP para melhor compreensão semântica
- Suporte a vocabulário customizado sem retreinar

Fluxo:
1. DETIC detecta alimentos na imagem com vocabulário customizado
2. Gera embedding de cada alimento detectado
3. Busca vetorial no catálogo usando cosine similarity
4. Retorna alimentos do catálogo que correspondem aos detectados
"""

import base64
import io
import logging
import os
from typing import List, Dict, Tuple
from PIL import Image
import numpy as np
import torch
from sqlmodel import Session, select

from app.models.food import Food
from app.services.embedding_service import generate_embedding

logger = logging.getLogger(__name__)

# Singletons para o modelo DETIC
_detic_predictor = None
_detic_metadata = None

# Vocabulário customizado de alimentos (pode ser expandido dinamicamente)
CUSTOM_FOOD_VOCABULARY = [
    # Frutas
    "banana", "apple", "orange", "strawberry", "grape", "watermelon",
    "pineapple", "mango", "papaya", "avocado", "coconut", "lemon",
    "peach", "pear", "cherry", "kiwi", "plum", "melon",
    # Vegetais
    "broccoli", "carrot", "tomato", "lettuce", "cabbage", "spinach",
    "onion", "garlic", "potato", "sweet potato", "bell pepper", "cucumber",
    "zucchini", "eggplant", "corn", "peas", "beans",
    # Proteínas
    "chicken", "beef", "pork", "fish", "salmon", "tuna", "egg", "tofu",
    "shrimp", "bacon", "sausage", "turkey", "lamb", "duck",
    # Grãos e Carboidratos
    "rice", "pasta", "bread", "potato", "beans", "quinoa", "oats",
    "noodles", "tortilla", "bagel", "croissant", "cereal",
    # Fast Food
    "pizza", "hamburger", "hot dog", "sandwich", "french fries",
    "donut", "cake", "ice cream", "cookie", "burrito", "taco",
    # Alimentos Brasileiros
    "pao de queijo", "coxinha", "brigadeiro", "acai", "feijoada",
    "tapioca", "mandioca", "farofa", "picanha", "pamonha",
    "acaraje", "moqueca", "vatapa", "pastel", "empada",
    # Bebidas
    "coffee", "juice", "soda", "water", "milk", "wine", "beer",
    "smoothie", "tea", "cocktail",
    # Outros
    "cheese", "yogurt", "butter", "oil", "sugar", "salt", "sauce",
    "honey", "chocolate", "nuts", "soup", "salad"
]


def get_detic_predictor():
    """
    Inicializa e retorna o preditor DETIC (singleton)

    DETIC requer:
    - Detectron2 instalado
    - Modelo DETIC baixado
    - CLIP embeddings para vocabulário customizado
    """
    global _detic_predictor, _detic_metadata

    if _detic_predictor is not None:
        return _detic_predictor, _detic_metadata

    try:
        logger.info("🔄 Inicializando modelo DETIC...")

        # Import detectron2 (lazy import para não quebrar se não estiver instalado)
        try:
            from detectron2.config import get_cfg
            from detectron2.engine import DefaultPredictor
            from detectron2.data import MetadataCatalog
            import sys
            sys.path.insert(0, 'third_party/CenterNet2/')
            from centernet.config import add_centernet_config
            from detic.config import add_detic_config
            from detic.predictor import VisualizationDemo
        except ImportError as e:
            logger.error(f"❌ DETIC não está instalado corretamente: {e}")
            logger.warning("⚠️ Usando modo fallback sem detecção de imagem")
            return None, None

        # Configura DETIC
        cfg = get_cfg()
        add_centernet_config(cfg)
        add_detic_config(cfg)

        # Caminho para o modelo (você precisa baixar o modelo)
        # Download: wget https://dl.fbaipublicfiles.com/detic/Detic_LCOCOI21k_CLIP_SwinB_896b32_4x_ft4x_max-size.pth
        model_path = os.getenv("DETIC_MODEL_PATH", "models/Detic_LCOCOI21k_CLIP_SwinB_896b32_4x_ft4x_max-size.pth")
        config_path = os.getenv("DETIC_CONFIG_PATH", "configs/Detic_LCOCOI21k_CLIP_SwinB_896b32_4x_ft4x_max-size.yaml")

        if not os.path.exists(model_path):
            logger.error(f"❌ Modelo DETIC não encontrado em: {model_path}")
            logger.warning("⚠️ Para usar DETIC, baixe o modelo de: https://github.com/facebookresearch/Detic")
            return None, None

        cfg.merge_from_file(config_path)
        cfg.MODEL.WEIGHTS = model_path
        cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
        cfg.MODEL.ROI_BOX_HEAD.ZEROSHOT_WEIGHT_PATH = 'rand'
        cfg.MODEL.ROI_HEADS.ONE_CLASS_PER_PROPOSAL = False

        # Cria o preditor
        _detic_predictor = DefaultPredictor(cfg)
        _detic_metadata = MetadataCatalog.get("__unused")
        _detic_metadata.thing_classes = CUSTOM_FOOD_VOCABULARY

        logger.info(f"✅ DETIC carregado com {len(CUSTOM_FOOD_VOCABULARY)} categorias de alimentos")
        return _detic_predictor, _detic_metadata

    except Exception as e:
        logger.error(f"❌ Erro ao carregar DETIC: {e}")
        logger.warning("⚠️ Sistema funcionará em modo fallback sem detecção de imagem")
        return None, None


def decode_base64_image(base64_string: str) -> Image.Image:
    """
    Decodifica uma string base64 em uma imagem PIL

    Args:
        base64_string: String base64 da imagem (com ou sem prefixo data:image/...)

    Returns:
        Imagem PIL em modo RGB
    """
    try:
        # Remove o prefixo "data:image/...;base64," se existir
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]

        # Decodifica base64 para bytes
        image_bytes = base64.b64decode(base64_string)

        # Converte bytes para imagem PIL
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        logger.info(f"✅ Imagem decodificada: {image.size[0]}x{image.size[1]} pixels")
        return image

    except Exception as e:
        logger.error(f"❌ Erro ao decodificar imagem: {e}")
        raise ValueError(f"Falha ao decodificar imagem base64: {str(e)}")


def detect_foods_with_detic(image: Image.Image, confidence_threshold: float = 0.5) -> List[str]:
    """
    Detecta alimentos em uma imagem usando DETIC

    Args:
        image: Imagem PIL
        confidence_threshold: Threshold mínimo de confiança (0-1)

    Returns:
        Lista de nomes de alimentos detectados (únicos)
    """
    try:
        predictor, metadata = get_detic_predictor()

        if predictor is None:
            logger.warning("⚠️ DETIC não disponível, retornando lista vazia")
            return []

        # Converte PIL para array numpy (formato BGR para OpenCV)
        image_np = np.array(image)[:, :, ::-1]

        # Executa predição
        outputs = predictor(image_np)

        # Extrai classes detectadas com confiança acima do threshold
        instances = outputs["instances"].to("cpu")
        scores = instances.scores.numpy()
        classes = instances.pred_classes.numpy()

        detected_foods = []

        for score, class_id in zip(scores, classes):
            if score >= confidence_threshold:
                if 0 <= class_id < len(CUSTOM_FOOD_VOCABULARY):
                    food_name = CUSTOM_FOOD_VOCABULARY[class_id]
                    detected_foods.append(food_name)
                    logger.info(f"  ✓ Detectado: {food_name} (confiança: {score:.2%})")

        # Retorna nomes únicos
        unique_foods = list(set(detected_foods))
        logger.info(f"✅ DETIC detectou {len(unique_foods)} tipo(s) de alimento(s) único(s)")
        return unique_foods

    except Exception as e:
        logger.error(f"❌ Erro na detecção com DETIC: {e}")
        # Em caso de erro, retorna lista vazia ao invés de falhar
        return []


def search_food_by_embedding_similarity(
    session: Session,
    query_embedding: List[float],
    limit: int = 5
) -> List[Tuple[Food, float]]:
    """
    Busca alimentos no catálogo usando similaridade vetorial (cosine distance)

    Args:
        session: Sessão do banco de dados
        query_embedding: Embedding do termo de busca
        limit: Número máximo de resultados

    Returns:
        Lista de tuplas (Food, similarity_score) ordenadas por similaridade
    """
    try:
        # Busca usando cosine distance (pgvector)
        # Nota: cosine_distance retorna a distância (0=idêntico, 2=oposto)
        # Similarity = 1 - distance
        query = select(
            Food,
            Food.embedding.cosine_distance(query_embedding).label("distance")
        )
        query = query.where(Food.embedding.isnot(None))
        query = query.order_by("distance")
        query = query.limit(limit)

        results = session.exec(query).all()

        # Converte distance para similarity (1 - distance)
        return [(food, round(1 - distance, 4)) for food, distance in results]

    except Exception as e:
        logger.error(f"❌ Erro na busca vetorial: {e}")
        return []


async def analyze_food_image(
    session: Session,
    base64_image: str,
    top_k_per_food: int = 3,
    confidence_threshold: float = 0.5
) -> Dict[str, any]:
    """
    Analisa uma imagem de alimentos e retorna os alimentos do catálogo correspondentes

    Fluxo:
    1. Decodifica a imagem
    2. Detecta alimentos com DETIC (open-vocabulary)
    3. Para cada alimento detectado:
       - Gera embedding do nome
       - Busca no catálogo por similaridade vetorial
    4. Retorna resultados estruturados

    Args:
        session: Sessão do banco de dados
        base64_image: Imagem codificada em base64
        top_k_per_food: Quantos alimentos do catálogo retornar por cada detecção
        confidence_threshold: Threshold mínimo de confiança do DETIC

    Returns:
        Dicionário com:
        {
            "detected_foods": ["banana", "apple"],
            "catalog_matches": [
                {
                    "detected_name": "banana",
                    "matches": [
                        {
                            "id": "uuid...",
                            "name": "Banana Prata",
                            "similarity": 0.95,
                            "category": "frutas",
                            "calories_per_100g": 90
                        },
                        ...
                    ]
                },
                ...
            ]
        }
    """
    try:
        logger.info("🔍 Iniciando análise de imagem de alimentos com DETIC...")

        # 1. Decodifica a imagem
        image = decode_base64_image(base64_image)

        # 2. Detecta alimentos com DETIC
        detected_food_names = detect_foods_with_detic(image, confidence_threshold)

        if not detected_food_names:
            logger.warning("⚠️ Nenhum alimento detectado na imagem")
            return {
                "success": True,
                "detected_foods": [],
                "catalog_matches": [],
                "total_detected": 0,
                "total_catalog_matches": 0,
                "message": "Nenhum alimento detectado na imagem"
            }

        # 3. Para cada alimento detectado, busca no catálogo
        catalog_matches = []

        for food_name in detected_food_names:
            logger.info(f"🔎 Buscando '{food_name}' no catálogo...")

            # Gera embedding do nome detectado
            query_embedding = generate_embedding(food_name)

            # Busca alimentos similares no catálogo
            similar_foods = search_food_by_embedding_similarity(
                session,
                query_embedding,
                limit=top_k_per_food
            )

            if similar_foods:
                matches = []
                for food, similarity in similar_foods:
                    matches.append({
                        "id": str(food.id),
                        "name": food.name,
                        "similarity": similarity,
                        "category": food.category,
                        "calories_per_100g": float(food.calorie_per_100g) if food.calorie_per_100g else None,
                        "serving_size_g": float(food.serving_size_g),
                        "serving_unit": food.serving_unit,
                        "source": food.source,
                        "is_verified": food.is_verified
                    })
                    logger.info(f"  ✓ {food.name} (similaridade: {similarity:.2%})")

                catalog_matches.append({
                    "detected_name": food_name,
                    "matches": matches
                })

        logger.info(f"✅ Análise concluída: {len(detected_food_names)} alimento(s) processado(s)")

        return {
            "success": True,
            "detected_foods": detected_food_names,
            "catalog_matches": catalog_matches,
            "total_detected": len(detected_food_names),
            "total_catalog_matches": sum(len(m["matches"]) for m in catalog_matches)
        }

    except Exception as e:
        logger.error(f"❌ Erro na análise de imagem: {e}")
        raise
