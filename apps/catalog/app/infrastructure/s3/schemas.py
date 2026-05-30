from pydantic import BaseModel


class GeneratePresignedUrlSchema(BaseModel):
    bucket: str
    object: str
    region: str
    expiration: int = 3600
