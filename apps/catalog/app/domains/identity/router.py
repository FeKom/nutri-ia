from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session

from app.api.dependencies import get_current_user, get_current_user_id, get_db
from app.core.security import (create_access_token, gef_csrf_config,
                               hash_password, verify_password)
from app.domains.identity.exceptions import (ProfileAlreadyExistsError,
                                             ProfileNotFoundError,
                                             UserAlreadyExistsError)
from app.domains.identity.repository import SQLModelIdentityRepository
from app.domains.identity.schemas import RegisterRequest, Token
from app.schemas.user import (UserProfileCreate, UserProfileResponse,
                              UserProfileUpdate)

auth_router = APIRouter()
users_router = APIRouter()


def _get_repo(session: Session = Depends(get_db)) -> SQLModelIdentityRepository:
    return SQLModelIdentityRepository(session)


_Repo = Annotated[SQLModelIdentityRepository, Depends(_get_repo)]


# ── Auth ──────────────────────────────────────────────────────────────────────


@auth_router.post(
    "/register", response_model=Token, status_code=status.HTTP_201_CREATED
)
def register(body: RegisterRequest, repo: _Repo) -> Token:
    if len(body.password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters"
        )
    if repo.get_user_by_username(body.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    user = repo.create_user(body.username, body.name, hash_password(body.password))
    return Token(access_token=create_access_token(user.id, user.username, user.name))


@auth_router.post("/login", response_model=Token)
def login(repo: _Repo, form: OAuth2PasswordRequestForm = Depends()) -> Token:
    user = repo.get_user_by_username(form.username)
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=create_access_token(user.id, user.username, user.name))


@auth_router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


# ── User profiles ─────────────────────────────────────────────────────────────


@users_router.post(
    "/profiles", response_model=UserProfileResponse, status_code=status.HTTP_201_CREATED
)
async def create_profile(
    profile: UserProfileCreate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    user_uuid = UUID(current_user_id)
    if repo.get_profile(user_uuid):
        raise HTTPException(
            status_code=400, detail=f"Perfil já existe para o usuário {user_uuid}"
        )
    db_profile = repo.create_profile(
        user_uuid,
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
    )
    return db_profile


@users_router.get("/profiles/me", response_model=UserProfileResponse)
async def get_my_profile(
    repo: _Repo, current_user_id: str = Depends(get_current_user_id)
) -> UserProfileResponse:
    profile = repo.get_profile(UUID(current_user_id))
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Perfil não encontrado para o usuário {current_user_id}",
        )
    return profile


@users_router.put("/profiles/me", response_model=UserProfileResponse)
async def update_my_profile(
    updates: UserProfileUpdate,
    repo: _Repo,
    current_user_id: str = Depends(get_current_user_id),
) -> UserProfileResponse:
    profile = repo.update_profile(
        UUID(current_user_id), updates.model_dump(exclude_unset=True)
    )
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Perfil não encontrado para o usuário {current_user_id}",
        )
    return UserProfileResponse.model_validate(profile)


@users_router.delete("/profiles/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_profile(
    repo: _Repo, current_user_id: str = Depends(get_current_user_id)
) -> None:
    if not repo.delete_profile(UUID(current_user_id)):
        raise HTTPException(
            status_code=404,
            detail=f"Perfil não encontrado para o usuário {current_user_id}",
        )


@users_router.get("/profiles/{user_id}", response_model=UserProfileResponse)
async def get_user_profile(user_id: UUID, repo: _Repo) -> UserProfileResponse:
    profile = repo.get_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=404, detail=f"Perfil não encontrado para o usuário {user_id}"
        )
    return profile
