from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.api.dependencies import get_current_user_id, get_db
from app.models.user import UserProfile
from app.schemas.user import UserProfileCreate, UserProfileUpdate, UserProfileResponse

router = APIRouter()


@router.post(
    "/profiles", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED
)
async def create_user_profile(
    profile: UserProfileCreate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    """
    Create a new user profile for the authenticated user.

    The user_id is taken from the JWT token, overriding any user_id in the request body.
    """
    try:
        user_uuid = UUID(current_user_id)

        # Check if profile already exists
        existing = db.exec(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Perfil já existe para o usuário {user_uuid}",
            )

        # Create new profile with authenticated user_id
        db_profile = UserProfile(
            user_id=user_uuid,
            name=profile.name,
            age=profile.age,
            weight_kg=profile.weight_kg,
            height_cm=profile.height_cm,
            gender=profile.gender,
            activity_level=profile.activity_level,
            diet_goal=profile.diet_goal,
            dietary_restrictions=profile.dietary_restrictions or [],
            allergies=profile.allergies or [],
            disliked_foods=profile.disliked_foods or [],
            preferred_cuisines=profile.preferred_cuisines or [],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)

        return db_profile
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao criar perfil: {str(e)}",
        )


@router.get("/profiles/me", response_model=UserProfileResponse)
async def get_my_profile(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    """
    Get the authenticated user's profile.
    """
    user_uuid = UUID(current_user_id)
    statement = select(UserProfile).where(UserProfile.user_id == user_uuid)
    profile = db.exec(statement).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Perfil não encontrado para o usuário {user_uuid}",
        )
    return profile


@router.put("/profiles/me", response_model=UserProfileResponse)
async def update_my_profile(
    updates: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    """
    Update the authenticated user's profile.

    Only provided fields will be updated (partial update).
    """
    try:
        user_uuid = UUID(current_user_id)

        # Get existing profile
        profile = db.exec(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        ).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Perfil não encontrado para o usuário {user_uuid}",
            )

        # Update only provided fields
        update_data = updates.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        profile.updated_at = datetime.utcnow()

        db.add(profile)
        db.commit()
        db.refresh(profile)

        return profile
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao atualizar perfil: {str(e)}",
        )


@router.delete("/profiles/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_profile(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id),
) -> None:
    """
    Delete the authenticated user's profile.

    This will also delete related data (meal logs, daily stats, meal plans).
    """
    try:
        user_uuid = UUID(current_user_id)

        # Get existing profile
        profile = db.exec(
            select(UserProfile).where(UserProfile.user_id == user_uuid)
        ).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Perfil não encontrado para o usuário {user_uuid}",
            )

        # Delete profile (cascade will handle related data if configured)
        db.delete(profile)
        db.commit()

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao deletar perfil: {str(e)}",
        )


@router.get("/profiles/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(
    user_id: UUID, db: Session = Depends(get_db)
) -> UserProfileResponse:
    """
    Get a user profile by user_id.

    This endpoint is public (used by backend services with JWT forwarding).
    """
    statement = select(UserProfile).where(UserProfile.user_id == user_id)
    profile = db.exec(statement).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Perfil não encontrado para o usuário {user_id}",
        )
    return profile
