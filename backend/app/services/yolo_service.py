from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import Settings
from app.models.schemas import DamageDetection
from app.services.severity_service import detection_severity_hint


BUILDING_CLASSES = {
    0: "crack",
    1: "leakage",
    2: "corrosion",
    3: "abscission",
    4: "bulge",
}

BUILDING_CLASS_ALIASES = {
    "crack": "crack",
    "cracks": "crack",
    "leak": "leakage",
    "leakage": "leakage",
    "water_damage": "leakage",
    "water_stain": "leakage",
    "rust": "corrosion",
    "corrosion": "corrosion",
    "spall": "abscission",
    "spalling": "abscission",
    "abscission": "abscission",
    "delamination": "abscission",
    "bulge": "bulge",
    "bulging": "bulge",
}

ROAD_CLASSES = {
    0: "crack",
    1: "pothole",
    2: "road_blockage",
    3: "debris",
    4: "traffic_cone",
    5: "stalled_vehicle",
}

ROAD_CLASS_ALIASES = {
    "crack": "crack",
    "cracks": "crack",
    "d00": "crack",
    "d10": "crack",
    "d20": "crack",
    "longitudinal_crack": "crack",
    "transverse_crack": "crack",
    "alligator_crack": "crack",
    "pothole": "pothole",
    "potholes": "pothole",
    "d40": "pothole",
    "road_blockage": "road_blockage",
    "debris": "debris",
    "traffic_cone": "traffic_cone",
    "stalled_vehicle": "stalled_vehicle",
}

MIN_CONFIDENCE_THRESHOLD = 0.20


class ModelUnavailableError(RuntimeError):
    pass


class DetectionRuntimeError(RuntimeError):
    pass


@dataclass
class ModelRun:
    inspection_type: str
    detections: list[DamageDetection]
    result: Any

    @property
    def average_confidence(self) -> float:
        if not self.detections:
            return 0.0
        return sum(d.confidence for d in self.detections) / len(self.detections)


@dataclass
class InspectionResult:
    inspection_type: str
    detections: list[DamageDetection]
    annotated_image_path: Path | None


class YOLOService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._models: dict[str, Any] = {}
        self._load_errors: dict[str, str] = {}

    def is_model_loaded(self, inspection_type: str) -> bool:
        try:
            self._get_model(inspection_type)
        except ModelUnavailableError:
            return False
        return True

    def inspect_image(
        self,
        image_path: Path,
        inspection_type: str,
        confidence_threshold: float | None = None,
    ) -> InspectionResult:
        configured_confidence = confidence_threshold or self.settings.confidence_threshold
        confidence = max(configured_confidence, MIN_CONFIDENCE_THRESHOLD)

        if inspection_type in {"road", "building"}:
            run = self._run_model(inspection_type, image_path, confidence)
            annotated = self._save_annotated_image(run, image_path)
            return InspectionResult(
                inspection_type=run.inspection_type,
                detections=run.detections,
                annotated_image_path=annotated,
            )

        if inspection_type != "auto":
            raise ValueError(f"Unsupported inspection_type: {inspection_type}")

        auto_runs: list[ModelRun] = []
        load_errors: list[ModelUnavailableError] = []
        for model_type in ("road", "building"):
            try:
                auto_runs.append(self._run_model(model_type, image_path, confidence))
            except ModelUnavailableError as error:
                load_errors.append(error)

        if not auto_runs:
            if load_errors:
                raise load_errors[0]
            raise ModelUnavailableError("No YOLO models are available for auto inspection.")

        selected = self._choose_auto_result(auto_runs)
        annotated = self._save_annotated_image(selected, image_path)
        return InspectionResult(
            inspection_type=selected.inspection_type,
            detections=selected.detections,
            annotated_image_path=annotated,
        )

    def _get_model(self, inspection_type: str) -> Any:
        if inspection_type in self._models:
            return self._models[inspection_type]

        model_path = self._model_path(inspection_type)
        if not model_path.exists():
            raise ModelUnavailableError(
                f"{inspection_type} YOLO model file is missing at {model_path}. "
                "Place the .pt weight file there or update the matching MODEL_PATH environment variable."
            )

        try:
            from ultralytics import YOLO

            model = YOLO(str(model_path))
        except Exception as error:
            self._load_errors[inspection_type] = str(error)
            raise ModelUnavailableError(
                f"Could not load {inspection_type} YOLO model from {model_path}: {error}"
            ) from error

        self._models[inspection_type] = model
        self._load_errors.pop(inspection_type, None)
        return model

    def _run_model(
        self,
        inspection_type: str,
        image_path: Path,
        confidence: float,
    ) -> ModelRun:
        model = self._get_model(inspection_type)
        try:
            results = model.predict(
                source=str(image_path),
                conf=confidence,
                save=False,
                verbose=False,
            )
        except Exception as error:
            raise DetectionRuntimeError(
                f"YOLO prediction failed for {inspection_type}: {error}"
            ) from error

        if not results:
            return ModelRun(inspection_type=inspection_type, detections=[], result=None)

        result = results[0]
        detections = self._parse_result(inspection_type, result, confidence)
        return ModelRun(inspection_type=inspection_type, detections=detections, result=result)

    def _parse_result(
        self,
        inspection_type: str,
        result: Any,
        confidence_threshold: float,
    ) -> list[DamageDetection]:
        boxes = getattr(result, "boxes", None)
        if boxes is None or len(boxes) == 0:
            return []

        fallback_class_map = BUILDING_CLASSES if inspection_type == "building" else ROAD_CLASSES
        result_class_names = getattr(result, "names", None) or {}
        detections: list[DamageDetection] = []
        xyxy_values = boxes.xyxy.cpu().tolist()
        confidence_values = boxes.conf.cpu().tolist()
        class_values = boxes.cls.cpu().tolist()

        for bbox, confidence, class_id in zip(xyxy_values, confidence_values, class_values):
            confidence_value = round(float(confidence), 4)
            if confidence_value < confidence_threshold:
                continue

            class_index = int(class_id)
            raw_damage_type = result_class_names.get(
                class_index,
                fallback_class_map.get(class_index, f"class_{class_index}"),
            )
            damage_type = self._normalize_damage_type(inspection_type, raw_damage_type)
            x1, y1, x2, y2 = [round(float(value), 2) for value in bbox]
            width = max(0.0, x2 - x1)
            height = max(0.0, y2 - y1)

            detections.append(
                DamageDetection(
                    damage_type=damage_type,
                    confidence=confidence_value,
                    bbox=[x1, y1, x2, y2],
                    estimated_area_pixels=int(round(width * height)),
                    severity_hint=detection_severity_hint(
                        inspection_type,
                        damage_type,
                        confidence_value,
                    ),
                )
            )

        return detections

    def _normalize_damage_type(self, inspection_type: str, damage_type: str) -> str:
        normalized = str(damage_type).strip().lower().replace(" ", "_").replace("-", "_")
        if inspection_type == "road":
            return ROAD_CLASS_ALIASES.get(normalized, normalized)
        return BUILDING_CLASS_ALIASES.get(normalized, normalized)

    def _save_annotated_image(self, run: ModelRun, image_path: Path) -> Path | None:
        if run.result is None:
            return None

        self.settings.annotated_dir.mkdir(parents=True, exist_ok=True)
        suffix = image_path.suffix.lower() if image_path.suffix else ".jpg"
        output_path = self.settings.annotated_dir / (
            f"{image_path.stem}_{run.inspection_type}_{uuid4().hex[:8]}{suffix}"
        )

        try:
            run.result.save(filename=str(output_path), conf=False)
        except Exception as error:
            raise DetectionRuntimeError(f"Could not save annotated image: {error}") from error

        return output_path

    def _choose_auto_result(self, runs: list[ModelRun]) -> ModelRun:
        def selection_key(run: ModelRun) -> tuple[int, float, int]:
            # Prefer more detections, then higher confidence. If tied with no
            # detections, prefer building for structural concrete scenes.
            building_tie_breaker = 1 if run.inspection_type == "building" else 0
            return (len(run.detections), run.average_confidence, building_tie_breaker)

        return max(runs, key=selection_key)

    def _model_path(self, inspection_type: str) -> Path:
        if inspection_type == "building":
            return self.settings.building_model_path
        if inspection_type == "road":
            return self.settings.road_model_path
        raise ValueError(f"Unsupported model type: {inspection_type}")
