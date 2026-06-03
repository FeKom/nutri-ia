import os
from functools import lru_cache
from typing import List, Union

import boto3
from botocore import config
from dotenv import load_dotenv
from pydantic import PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

load_dotenv()


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("AWS_S3_ENDPOINT"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_DEFAULT_REGION"),
        config=config.Config(signature_version="s3v4"),
    )


_APP_ENV = os.getenv("APP_ENV", "development")


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        # Loads .env first (base), then .env.{APP_ENV} overrides it
        env_file=(".env", f".env.{_APP_ENV}"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        # ignora variaveis extra do .env por ex: POSTGRES_USER
        extra="ignore",
    )

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Nutria Food Catalog API"
    PROJECT_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8004

    # Database Configuration
    DATABASE_URL: PostgresDsn

    # JWT Configuration - HS256 with shared secret
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    JWT_ISSUER: str = "nutria-catalog"
    JWT_AUDIENCE: str = "nutria"

    # S3 / Backblaze B2
    AWS_S3_BUCKET: str = ""

    # Mastra backend URL
    MASTRA_URL: str = "http://localhost:4111"

    # GitHub Models — used by LLM-as-judge eval scorers (same token as backend)
    GITHUB_TOKEN: str = ""

    # CORS Configuration - usando str para evitar JSON parsing automático
    BACKEND_CORS_ORIGINS: Union[List[str], str] = ""

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if not v:
            return []
        if isinstance(v, str):
            # separada por vírgula se for string
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        raise ValueError(f"Invalid CORS origins: {v}")


settings = Settings()
