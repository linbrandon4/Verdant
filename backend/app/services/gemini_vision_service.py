from __future__ import annotations

import io
import json
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Literal
from uuid import uuid4

from PIL import Image, ImageDraw, ImageFont, ImageOps
from pydantic import BaseModel, Field

from app.config import Settings
from app.models.schemas import DamageDetection
from app.services.severity_service import detection_severity_hint
from app.services.yolo_service import InspectionResult


VISION_SYSTEM_INSTRUCTION = (
    "You are a visual infrastructure damage inspector. You analyze uploaded road "
    "or building images and return only valid JSON. Localize visible damage with "
    "bounding boxes in original image pixel coordinates."
)

ROAD_ALIASES = {
    "pothole": "pothole",
    "potholes": "pothole",
    "hole": "pothole",
    "road_hole": "pothole",
    "pavement_hole": "pothole",
    "crack": "crack",
    "cracks": "crack",
    "road_crack": "crack",
    "alligator_crack": "crack",
    "debris": "debris",
    "road_debris": "debris",
    "road_blockage": "road_blockage",
    "blockage": "road_blockage",
}

BUILDING_ALIASES = {
    "crack": "crack",
    "cracks": "crack",
    "wall_crack": "crack",
    "facade_crack": "crack",
    "leak": "leakage",
    "leakage": "leakage",
    "water_damage": "leakage",
    "water_stain": "leakage",
    "rust": "corrosion",
    "corrosion": "corrosion",
    "spall": "abscission",
    "spalling": "abscission",
    "abscission": "abscission",
    "bulge": "bulge",
    "bulging": "bulge",
}


class GeminiVisionError(RuntimeError):
    pass


class GeminiVisionDetection(BaseModel):
    damage_type: str
    confidence: float = Field(ge=0, le=1)
    bbox: list[float] = Field(min_length=4, max_length=4)
    severity_hint: Literal["low", "medium", "high"] = "medium"


class GeminiVisionPayload(BaseModel):
    inspection_type: Literal["road", "building"]
    detections: list[GeminiVisionDetection] = Field(default_factory=list)
    notes: str = ""


@dataclass
class GeminiVisionInspectionResult:
    inspection: InspectionResult
    notes: str


class GeminiVisionService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def inspect_image(
        self,
        image_path: Path,
        inspection_type: str,
        confidence_threshold: float | None = None,
    ) -> GeminiVisionInspectionResult:
        if not self.settings.gemini_api_key:
            raise GeminiVisionError("GEMINI_API_KEY is not configured.")

        confidence = max(confidence_threshold or self.settings.confidence_threshold, 0.50)
        image_bytes, width, height, mime_type = _oriented_image_payload(image_path)
        prompt = _build_prompt(
            inspection_type=inspection_type,
            width=width,
            height=height,
            confidence=confidence,
        )

        try:
            response_text = self._generate_with_mime_schema(prompt, image_bytes, mime_type)
        except Exception as mime_schema_error:
            if not self._is_sdk_config_compatibility_error(mime_schema_error):
                raise GeminiVisionError(f"Gemini vision request failed: {mime_schema_error}") from mime_schema_error

            try:
                response_text = self._generate_with_response_format(prompt, image_bytes, mime_type)
            except Exception as response_format_error:
                raise GeminiVisionError(
                    "Gemini vision request failed: "
                    f"{mime_schema_error}; response_format attempt failed: {response_format_error}"
                ) from response_format_error

        payload = _parse_payload(response_text)
        selected_type = payload.inspection_type
        if inspection_type in {"road", "building"}:
            selected_type = inspection_type

        detections = _normalize_detections(
            payload.detections,
            inspection_type=selected_type,
            confidence_threshold=confidence,
            width=width,
            height=height,
        )
        annotated_path = _save_annotated_image(
            image_path=image_path,
            output_dir=self.settings.annotated_dir,
            inspection_type=selected_type,
            detections=detections,
        )
        return GeminiVisionInspectionResult(
            inspection=InspectionResult(
                inspection_type=selected_type,
                detections=detections,
                annotated_image_path=annotated_path,
            ),
            notes=payload.notes,
        )

    def _generate_with_mime_schema(self, prompt: str, image_bytes: bytes, mime_type: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=[
                    prompt,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
                config=types.GenerateContentConfig(
                    system_instruction=VISION_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=GeminiVisionPayload,
                ),
            )
            return response.text or "{}"
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    def _generate_with_response_format(self, prompt: str, image_bytes: bytes, mime_type: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=[
                    prompt,
                    types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
                config={
                    "system_instruction": VISION_SYSTEM_INSTRUCTION,
                    "response_format": {
                        "text": {
                            "mime_type": "application/json",
                            "schema": GeminiVisionPayload.model_json_schema(),
                        }
                    },
                },
            )
            return response.text or "{}"
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    def _is_sdk_config_compatibility_error(self, error: Exception) -> bool:
        message = str(error).lower()
        return (
            "response_mime_type" in message
            or "response_schema" in message
            or ("generatecontentconfig" in message and "extra inputs" in message)
        )


def _build_prompt(*, inspection_type: str, width: int, height: int, confidence: float) -> str:
    requested_type = (
        "Auto-classify the image as road or building first."
        if inspection_type == "auto"
        else f"Analyze it as a {inspection_type} inspection."
    )
    return (
        f"{requested_type}\n"
        f"The original image size is {width}x{height} pixels.\n"
        "Return bounding boxes as [x1, y1, x2, y2] using that exact pixel coordinate system.\n"
        f"Only include detections with confidence >= {confidence:.2f}.\n"
        "For road images, label localized pavement defects as pothole, crack, debris, or road_blockage. "
        "Treat dark circular or irregular pavement depressions, broken asphalt spots, and patch-like holes "
        "as pothole candidates when visible; include uncertain but likely potholes with confidence 0.50-0.70. "
        "Do not label vehicles, lane markings, trees, shadows, or normal road texture as damage.\n"
        "For building images, label localized visible damage as crack, leakage, corrosion, abscission, or bulge.\n"
        "For building or bridge cracks, make the crack bbox tight around the visible crack path only. "
        "Do not extend the box down empty columns, into sky, vehicles, signs, or undamaged support areas. "
        "If the crack bends, cover the full visible crack path with the smallest rectangle that contains it.\n"
        "If no visible damage can be localized, return an empty detections list.\n"
        "Return exactly this JSON shape: "
        '{"inspection_type":"road|building","detections":[{"damage_type":"pothole",'
        '"confidence":0.75,"bbox":[x1,y1,x2,y2],"severity_hint":"low|medium|high"}],"notes":"short reasoning"}'
    )


def _parse_payload(response_text: str) -> GeminiVisionPayload:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return GeminiVisionPayload.model_validate_json(cleaned)
    except Exception as error:
        try:
            return GeminiVisionPayload.model_validate(json.loads(cleaned))
        except Exception as nested_error:
            raise GeminiVisionError(f"Gemini returned invalid vision JSON: {nested_error}") from error


def _normalize_detections(
    detections: list[GeminiVisionDetection],
    *,
    inspection_type: str,
    confidence_threshold: float,
    width: int,
    height: int,
) -> list[DamageDetection]:
    normalized: list[DamageDetection] = []
    for detection in detections:
        confidence = round(float(detection.confidence), 4)
        if confidence < confidence_threshold:
            continue

        damage_type = _normalize_damage_type(inspection_type, detection.damage_type)
        bbox = _normalize_bbox(detection.bbox, width=width, height=height)
        if bbox is None:
            continue

        x1, y1, x2, y2 = bbox
        area = int(round((x2 - x1) * (y2 - y1)))
        severity_hint = detection.severity_hint
        if severity_hint not in {"low", "medium", "high"}:
            severity_hint = detection_severity_hint(inspection_type, damage_type, confidence)

        normalized.append(
            DamageDetection(
                damage_type=damage_type,
                confidence=confidence,
                bbox=[x1, y1, x2, y2],
                estimated_area_pixels=area,
                severity_hint=severity_hint,
            )
        )

    return normalized


def _normalize_damage_type(inspection_type: str, damage_type: str) -> str:
    normalized = str(damage_type).strip().lower().replace(" ", "_").replace("-", "_")
    if inspection_type == "road":
        return ROAD_ALIASES.get(normalized, normalized)
    return BUILDING_ALIASES.get(normalized, normalized)


def _normalize_bbox(values: list[float], *, width: int, height: int) -> list[float] | None:
    coords = [float(value) for value in values[:4]]
    max_coord = max(coords)
    x1, y1, x2, y2 = coords

    if max_coord <= 1.0:
        x1, x2 = x1 * width, x2 * width
        y1, y2 = y1 * height, y2 * height
    elif max_coord <= 1000 and (x2 > width or y2 > height):
        x1, x2 = x1 / 1000 * width, x2 / 1000 * width
        y1, y2 = y1 / 1000 * height, y2 / 1000 * height

    left, right = sorted((max(0.0, min(width, x1)), max(0.0, min(width, x2))))
    top, bottom = sorted((max(0.0, min(height, y1)), max(0.0, min(height, y2))))
    if right - left < 3 or bottom - top < 3:
        return None

    return [round(left, 2), round(top, 2), round(right, 2), round(bottom, 2)]


def _save_annotated_image(
    *,
    image_path: Path,
    output_dir: Path,
    inspection_type: str,
    detections: list[DamageDetection],
) -> Path | None:
    output_dir.mkdir(parents=True, exist_ok=True)
    suffix = image_path.suffix.lower() if image_path.suffix else ".jpg"
    output_path = output_dir / f"{image_path.stem}_{inspection_type}_gemini_{uuid4().hex[:8]}{suffix}"

    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")

    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    for detection in detections:
        x1, y1, x2, y2 = detection.bbox
        label = detection.damage_type
        color = "#ffb000" if detection.damage_type == "pothole" else "#ff3b30"
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        text_box = draw.textbbox((x1, y1), label, font=font)
        text_height = text_box[3] - text_box[1]
        text_width = text_box[2] - text_box[0]
        label_top = max(0, y1 - text_height - 6)
        draw.rectangle(
            [x1, label_top, x1 + text_width + 6, label_top + text_height + 4],
            fill=color,
        )
        draw.text((x1 + 3, label_top + 2), label, fill="#111111", font=font)

    image.save(output_path)
    return output_path


def _oriented_image_payload(image_path: Path) -> tuple[bytes, int, int, str]:
    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        suffix = image_path.suffix.lower()
        buffer = io.BytesIO()
        if suffix == ".png":
            image.save(buffer, format="PNG")
            return buffer.getvalue(), width, height, "image/png"
        image.save(buffer, format="JPEG", quality=92)
        return buffer.getvalue(), width, height, "image/jpeg"


def _image_size(image_path: Path) -> tuple[int, int]:
    with Image.open(image_path) as image:
        image = ImageOps.exif_transpose(image)
        return image.size


def _mime_type_for(image_path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(image_path.name)
    if mime_type:
        return mime_type

    suffix = image_path.suffix.lower()
    if suffix == ".webp":
        return "image/webp"
    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    return "application/octet-stream"
