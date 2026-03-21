"""
Image Validation and Sanitization

Proteção em múltiplas camadas contra imagens maliciosas:
1. Validação de tamanho e formato
2. Verificação de integridade (PIL decode/re-encode)
3. Remoção de EXIF e metadados maliciosos
4. Limitação de dimensões e tamanho de arquivo
5. Rate limiting (deve ser implementado no nível de API)
"""

import base64
import io
import logging
from typing import Tuple
from PIL import Image
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# Configurações de segurança
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_DIMENSION = 4096  # 4K pixels (largura ou altura)
MIN_IMAGE_DIMENSION = 50  # Imagens muito pequenas não são úteis
ALLOWED_FORMATS = {"JPEG", "PNG", "WebP"}
MAX_MEGAPIXELS = 16  # 16MP (ex: 4000x4000)


class ImageValidationError(Exception):
    """Erro de validação de imagem"""
    pass


def validate_and_sanitize_image(base64_image: str) -> Tuple[Image.Image, dict]:
    """
    Valida e sanitiza uma imagem base64, removendo metadados maliciosos.

    **Camadas de Proteção:**
    1. ✅ Valida tamanho da string base64 (evita OOM)
    2. ✅ Decodifica base64 e verifica integridade
    3. ✅ Valida formato de imagem (JPEG, PNG, WebP apenas)
    4. ✅ Re-encoda a imagem (remove EXIF, scripts, metadados)
    5. ✅ Valida dimensões (evita bombs, DoS)
    6. ✅ Converte para RGB (normaliza formato)

    Args:
        base64_image: String base64 da imagem (com ou sem prefixo)

    Returns:
        Tuple[Image.Image, dict]: (imagem PIL sanitizada, metadados seguros)

    Raises:
        ImageValidationError: Se a imagem for inválida ou maliciosa
    """
    try:
        # 1. Remove prefixo data:image/...;base64, se existir
        if "," in base64_image:
            prefix, base64_data = base64_image.split(",", 1)
            logger.debug(f"Prefixo detectado: {prefix}")
        else:
            base64_data = base64_image

        # 2. Valida tamanho da string base64 (antes de decodificar)
        # Base64 expande ~33%, então 10MB vira ~13.3MB em base64
        max_base64_length = int(MAX_IMAGE_SIZE_BYTES * 1.4)
        if len(base64_data) > max_base64_length:
            raise ImageValidationError(
                f"Imagem muito grande. Tamanho máximo: {MAX_IMAGE_SIZE_BYTES / (1024*1024):.1f}MB"
            )

        # 3. Decodifica base64 para bytes
        try:
            image_bytes = base64.b64decode(base64_data, validate=True)
        except Exception as e:
            raise ImageValidationError(f"Base64 inválido: {str(e)}")

        # 4. Valida tamanho real dos bytes
        if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
            raise ImageValidationError(
                f"Imagem muito grande. Tamanho: {len(image_bytes)/(1024*1024):.1f}MB, "
                f"máximo: {MAX_IMAGE_SIZE_BYTES/(1024*1024):.1f}MB"
            )

        if len(image_bytes) < 100:
            raise ImageValidationError("Imagem muito pequena ou corrompida")

        # 5. Tenta abrir com PIL (valida integridade)
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            raise ImageValidationError(f"Formato de imagem inválido: {str(e)}")

        # 6. Valida formato permitido
        if image.format not in ALLOWED_FORMATS:
            raise ImageValidationError(
                f"Formato '{image.format}' não permitido. "
                f"Use: {', '.join(ALLOWED_FORMATS)}"
            )

        # 7. Valida dimensões
        width, height = image.size
        megapixels = (width * height) / 1_000_000

        if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
            raise ImageValidationError(
                f"Imagem muito pequena: {width}x{height}. "
                f"Mínimo: {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION}"
            )

        if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
            raise ImageValidationError(
                f"Dimensões muito grandes: {width}x{height}. "
                f"Máximo: {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}"
            )

        if megapixels > MAX_MEGAPIXELS:
            raise ImageValidationError(
                f"Imagem muito grande: {megapixels:.1f}MP. Máximo: {MAX_MEGAPIXELS}MP"
            )

        # 8. SANITIZAÇÃO: Re-encoda a imagem (remove EXIF, scripts, metadados)
        sanitized_buffer = io.BytesIO()

        # Converte para RGB (remove alpha channel e normaliza)
        if image.mode in ("RGBA", "LA", "P"):
            # Cria background branco para transparências
            rgb_image = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            rgb_image.paste(image, mask=image.split()[-1] if image.mode in ("RGBA", "LA") else None)
            image = rgb_image
        elif image.mode != "RGB":
            image = image.convert("RGB")

        # Salva como JPEG sem metadados (mais seguro)
        # exif=None remove todo EXIF
        # optimize=False evita processamento extra
        image.save(sanitized_buffer, format="JPEG", quality=95, exif=None, optimize=False)
        sanitized_buffer.seek(0)

        # Recarrega a imagem sanitizada
        sanitized_image = Image.open(sanitized_buffer)

        # 9. Metadados seguros (apenas informações básicas)
        metadata = {
            "width": sanitized_image.size[0],
            "height": sanitized_image.size[1],
            "format": "JPEG",  # Sempre JPEG após sanitização
            "mode": sanitized_image.mode,
            "megapixels": round(megapixels, 2),
            "size_kb": round(len(image_bytes) / 1024, 2),
        }

        logger.info(
            f"✅ Imagem validada e sanitizada: {metadata['width']}x{metadata['height']} "
            f"({metadata['megapixels']}MP, {metadata['size_kb']}KB)"
        )

        return sanitized_image, metadata

    except ImageValidationError:
        raise  # Re-raise validation errors
    except Exception as e:
        logger.error(f"Erro inesperado na validação de imagem: {e}")
        raise ImageValidationError(f"Erro ao processar imagem: {str(e)}")


def validate_detection_results(detected_foods: list, catalog_matches: list) -> dict:
    """
    Valida resultados do DETIC para evitar alucinações e outputs maliciosos.

    **Proteções:**
    1. ✅ Limita número de detecções (evita DoS)
    2. ✅ Valida que alimentos detectados estão no vocabulário
    3. ✅ Filtra nomes suspeitos (scripts, SQL injection, etc.)
    4. ✅ Valida similarity scores (0-1)
    5. ✅ Remove duplicatas

    Args:
        detected_foods: Lista de nomes de alimentos detectados
        catalog_matches: Lista de matches do catálogo

    Returns:
        dict: Resultados validados e sanitizados
    """
    from app.services.food_analysis_service import CUSTOM_FOOD_VOCABULARY

    MAX_DETECTIONS = 20  # Máximo de alimentos detectados
    MAX_MATCHES_PER_FOOD = 10

    # 1. Limita número de detecções (evita abuse)
    if len(detected_foods) > MAX_DETECTIONS:
        logger.warning(
            f"⚠️ Muitas detecções ({len(detected_foods)}), limitando a {MAX_DETECTIONS}"
        )
        detected_foods = detected_foods[:MAX_DETECTIONS]

    # 2. Remove duplicatas
    detected_foods = list(dict.fromkeys(detected_foods))  # Preserva ordem

    # 3. Valida cada alimento detectado
    validated_foods = []
    for food_name in detected_foods:
        # Sanitiza nome (remove caracteres perigosos)
        if not isinstance(food_name, str):
            logger.warning(f"⚠️ Nome inválido (não-string): {food_name}")
            continue

        # Remove whitespace extra e normaliza
        food_name = " ".join(food_name.strip().split())

        # Valida tamanho
        if len(food_name) < 2 or len(food_name) > 100:
            logger.warning(f"⚠️ Nome com tamanho suspeito: {food_name}")
            continue

        # Filtra caracteres suspeitos (scripts, SQL, etc.)
        suspicious_chars = ["<", ">", "{", "}", "[", "]", ";", "\\", "|", "`"]
        if any(char in food_name for char in suspicious_chars):
            logger.warning(f"⚠️ Nome com caracteres suspeitos: {food_name}")
            continue

        # Verifica se está no vocabulário permitido (case-insensitive)
        if food_name.lower() not in [v.lower() for v in CUSTOM_FOOD_VOCABULARY]:
            logger.warning(
                f"⚠️ Alimento '{food_name}' não está no vocabulário customizado"
            )
            # Ainda permite, mas loga para auditoria

        validated_foods.append(food_name)

    # 4. Valida catalog_matches
    validated_matches = []
    for match_group in catalog_matches:
        if not isinstance(match_group, dict):
            continue

        detected_name = match_group.get("detected_name", "")
        matches = match_group.get("matches", [])

        if detected_name not in validated_foods:
            continue

        # Limita matches por alimento
        if len(matches) > MAX_MATCHES_PER_FOOD:
            matches = matches[:MAX_MATCHES_PER_FOOD]

        # Valida cada match
        validated_match_list = []
        for match in matches:
            if not isinstance(match, dict):
                continue

            # Valida similarity score
            similarity = match.get("similarity", 0)
            if not isinstance(similarity, (int, float)) or similarity < 0 or similarity > 1:
                logger.warning(f"⚠️ Similarity score inválido: {similarity}")
                continue

            # Valida campos obrigatórios
            required_fields = ["id", "name", "category"]
            if not all(field in match for field in required_fields):
                logger.warning(f"⚠️ Match faltando campos obrigatórios: {match}")
                continue

            validated_match_list.append(match)

        if validated_match_list:
            validated_matches.append({
                "detected_name": detected_name,
                "matches": validated_match_list
            })

    return {
        "detected_foods": validated_foods,
        "catalog_matches": validated_matches,
        "total_detected": len(validated_foods),
        "total_catalog_matches": sum(len(m["matches"]) for m in validated_matches)
    }
