"""
Script para criar perfil de usuário no banco de dados
"""
import sys
from pathlib import Path

# Adiciona o diretório raiz do projeto ao Python path
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from app.database.database import engine
from app.models.user import UserProfile
from sqlmodel import Session
from datetime import datetime


def create_user_profile(
    user_id: str,
    name: str = "Usuário Teste",
    age: int = 30,
    weight_kg: float = 70.0,
    height_cm: float = 170.0,
    activity_level: str = "moderate",
    diet_goal: str = "maintain",
    dietary_restrictions: list[str] = None,
    allergies: list[str] = None,
    disliked_foods: list[str] = None,
):
    """
    Cria um perfil de usuário no banco de dados

    Args:
        user_id: UUID do usuário (deve ser o mesmo UUID gerado pelo Better Auth)
        name: Nome do usuário
        age: Idade
        weight_kg: Peso em kg
        height_cm: Altura em cm
        activity_level: Nível de atividade (sedentary, light, moderate, active, very_active)
        diet_goal: Objetivo (weight_loss, weight_gain, maintain)
        dietary_restrictions: Lista de restrições alimentares (ex: ["vegetarian", "vegan"])
        allergies: Lista de alergias (ex: ["peanuts", "shellfish"])
        disliked_foods: Lista de alimentos que não gosta (ex: ["broccoli", "liver"])
    """
    with Session(engine) as session:
        # Verifica se já existe
        existing = session.get(UserProfile, user_id)
        if existing:
            print(f"❌ Perfil já existe para user_id: {user_id}")
            return existing

        # Cria novo perfil
        profile = UserProfile(
            user_id=user_id,
            name=name,
            age=age,
            weight_kg=weight_kg,
            height_cm=height_cm,
            activity_level=activity_level,
            diet_goal=diet_goal,
            dietary_restrictions=dietary_restrictions or [],
            allergies=allergies or [],
            disliked_foods=disliked_foods or [],
            preferred_cuisines=[],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        session.add(profile)
        session.commit()
        session.refresh(profile)

        print(f"✅ Perfil criado com sucesso!")
        print(f"   User ID: {profile.user_id}")
        print(f"   Nome: {profile.name}")
        print(f"   Idade: {profile.age}")
        print(f"   Peso: {profile.weight_kg}kg")
        print(f"   Altura: {profile.height_cm}cm")
        print(f"   Restrições: {profile.dietary_restrictions}")
        print(f"   Alergias: {profile.allergies}")
        print(f"   Não gosta: {profile.disliked_foods}")

        return profile


if __name__ == "__main__":
    # IMPORTANTE: Substitua este UUID pelo UUID gerado do seu usuário Better Auth
    # Você pode pegar este UUID dos logs do frontend quando fizer login:
    # console.log('👤 User session:', { uuid: '...' })

    USER_ID = "23cac570-6121-4492-0419-96c739d22b3d"  # Substitua pelo seu UUID!

    create_user_profile(
        user_id=USER_ID,
        name="Vinicius",  # Seu nome
        age=30,  # Sua idade
        weight_kg=75.0,  # Seu peso
        height_cm=175.0,  # Sua altura
        activity_level="moderate",  # sedentary, light, moderate, active, very_active
        diet_goal="maintain",  # weight_loss, weight_gain, maintain
        dietary_restrictions=[],  # Ex: ["vegetarian", "vegan", "gluten-free"]
        allergies=[],  # Ex: ["peanuts", "shellfish", "lactose"]
        disliked_foods=["liver", "broccoli"],  # Alimentos que não gosta
    )
