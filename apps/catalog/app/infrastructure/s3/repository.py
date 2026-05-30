from botocore.exceptions import ClientError

from app.core.config import get_s3_client, settings

_UPLOAD_EXPIRY = 900   # 15 min — enough for large PDFs
_DOWNLOAD_EXPIRY = 3600


def generate_upload_url(b2_key: str) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.AWS_S3_BUCKET,
            "Key": b2_key,
            "ContentType": "application/pdf",
        },
        ExpiresIn=_UPLOAD_EXPIRY,
    )


def generate_download_url(b2_key: str) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": b2_key},
        ExpiresIn=_DOWNLOAD_EXPIRY,
    )


def object_exists(b2_key: str) -> tuple[bool, int | None]:
    """Returns (exists, size_bytes). Raises ClientError on unexpected errors."""
    s3 = get_s3_client()
    try:
        resp = s3.head_object(Bucket=settings.AWS_S3_BUCKET, Key=b2_key)
        return True, resp.get("ContentLength")
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return False, None
        raise
