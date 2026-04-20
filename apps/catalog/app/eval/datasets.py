import json
from pathlib import Path
from typing import Any

DATASETS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "datasets"
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "tests" / "eval" / "prompts"


def list_datasets() -> list[str]:
    if not DATASETS_DIR.exists():
        return []
    return [f.name for f in DATASETS_DIR.iterdir() if f.suffix in (".json", ".pdf", ".md")]


def load_dataset(path_or_name: str) -> Any:
    """
    Load a dataset by filename (relative to DATASETS_DIR) or absolute path.
    Returns parsed list for JSON, list of page strings for PDF, raw string for MD.
    """
    path = Path(path_or_name)
    if not path.is_absolute():
        path = DATASETS_DIR / path_or_name

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    match path.suffix.lower():
        case ".json":
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        case ".pdf":
            try:
                import pdfplumber
            except ImportError:
                raise ImportError("Run: pip install pdfplumber")
            with pdfplumber.open(path) as pdf:
                return [page.extract_text() or "" for page in pdf.pages]
        case ".md":
            with open(path, encoding="utf-8") as f:
                return f.read()
        case _:
            raise ValueError(f"Unsupported file extension: {path.suffix}")


def list_prompts() -> list[str]:
    if not PROMPTS_DIR.exists():
        return []
    return [f.name for f in PROMPTS_DIR.iterdir() if f.suffix == ".md"]


def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Prompt not found: {path}")
    with open(path, encoding="utf-8") as f:
        return f.read()
