from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def _resolve_backend_path(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path
    return (BASE_DIR / path).resolve()


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    use_gemini_vision_analysis: bool = _env_bool("USE_GEMINI_VISION_ANALYSIS", True)
    google_places_api_key: str = os.getenv("GOOGLE_PLACES_API_KEY", "")
    confidence_threshold: float = float(os.getenv("YOLO_CONFIDENCE_THRESHOLD", "0.50"))

    building_model_path: Path = _resolve_backend_path(
        os.getenv("BUILDING_MODEL_PATH", "weights/building_damage.pt")
    )
    road_model_path: Path = _resolve_backend_path(
        os.getenv("ROAD_MODEL_PATH", "weights/road_damage.pt")
    )
    upload_dir: Path = _resolve_backend_path(os.getenv("UPLOAD_DIR", "uploads"))
    annotated_dir: Path = _resolve_backend_path(
        os.getenv("ANNOTATED_UPLOAD_DIR", "uploads/annotated")
    )


settings = Settings()
