from __future__ import annotations

import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError


class InvalidImageError(ValueError):
    pass


def ensure_upload_directories(upload_dir: Path, annotated_dir: Path) -> None:
    upload_dir.mkdir(parents=True, exist_ok=True)
    annotated_dir.mkdir(parents=True, exist_ok=True)


def save_upload_file(upload: UploadFile, upload_dir: Path) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    original_name = Path(upload.filename or "inspection_image").name
    safe_stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", Path(original_name).stem).strip("._")
    safe_stem = safe_stem or "inspection_image"
    suffix = Path(original_name).suffix.lower() or ".jpg"
    output_path = upload_dir / f"{safe_stem}_{uuid4().hex}{suffix}"

    with output_path.open("wb") as destination:
        shutil.copyfileobj(upload.file, destination)

    return output_path


def validate_image_file(image_path: Path) -> None:
    try:
        with Image.open(image_path) as image:
            image.verify()
    except (UnidentifiedImageError, OSError) as error:
        raise InvalidImageError("Uploaded file is not a valid image.") from error


def remove_file_if_exists(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass


def upload_url_for(path: Path, upload_dir: Path) -> str:
    relative_path = path.relative_to(upload_dir).as_posix()
    return f"/uploads/{relative_path}"
