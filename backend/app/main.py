from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from app.config import BASE_DIR, settings
from app.models.schemas import GeminiReport, HealthResponse, InspectionResponse, InspectionType, LocalBusiness
from app.services.gemini_business_service import GeminiBusinessSearchError, GeminiBusinessService
from app.services.gemini_service import GeminiReportError, GeminiService, build_fallback_report
from app.services.gemini_vision_service import GeminiVisionError, GeminiVisionService
from app.services.locations_service import get_cities_for_state, get_state_options, resolve_inspection_location
from app.services.places_service import build_local_business_search_terms, find_local_businesses
from app.services.severity_service import build_aggregates, score_detections
from app.services.yolo_service import DetectionRuntimeError, ModelUnavailableError, YOLOService
from app.utils.file_utils import (
    InvalidImageError,
    ensure_upload_directories,
    remove_file_if_exists,
    save_upload_file,
    upload_url_for,
    validate_image_file,
)


ensure_upload_directories(settings.upload_dir, settings.annotated_dir)

app = FastAPI(
    title="InfraVision AI Backend",
    version="1.0.0",
    description="YOLOv8 infrastructure damage inspection API with Gemini reporting.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")
app.mount("/static", StaticFiles(directory=BASE_DIR / "app" / "static"), name="static")

yolo_service = YOLOService(settings)
gemini_service = GeminiService(settings)
gemini_vision_service = GeminiVisionService(settings)
gemini_business_service = GeminiBusinessService(settings)

BUSINESS_SEARCH_TIMEOUT_SECONDS = 12.0


async def _fetch_local_businesses(
    *,
    resolved_city: str | None,
    resolved_state: str | None,
    inspection_type: str,
    detections,
) -> list[LocalBusiness]:
    if not resolved_city or not resolved_state:
        return []

    fallback_args = {
        "inspection_type": inspection_type,
        "detections": detections,
        "api_key": settings.google_places_api_key,
        "city": resolved_city,
        "state": resolved_state,
    }

    if settings.gemini_api_key:
        try:
            return await asyncio.wait_for(
                run_in_threadpool(
                    gemini_business_service.find_local_businesses,
                    inspection_type=inspection_type,
                    detections=detections,
                    city=resolved_city,
                    state=resolved_state,
                ),
                timeout=BUSINESS_SEARCH_TIMEOUT_SECONDS,
            )
        except (GeminiBusinessSearchError, asyncio.TimeoutError):
            return await run_in_threadpool(find_local_businesses, **fallback_args)

    return await run_in_threadpool(find_local_businesses, **fallback_args)


async def _fetch_gemini_report(
    *,
    inspection_type: str,
    detections,
    aggregates,
    assessment,
    location: dict[str, str | None],
    search_terms: list[str],
    resolved_city: str | None,
    resolved_state: str | None,
) -> GeminiReport:
    try:
        return await run_in_threadpool(
            gemini_service.generate_report,
            inspection_type=inspection_type,
            detections=detections,
            aggregates=aggregates,
            assessment=assessment,
            location=location,
            search_terms=search_terms,
        )
    except GeminiReportError as error:
        return build_fallback_report(
            inspection_type=inspection_type,
            detections=detections,
            assessment=assessment,
            city=resolved_city,
            state=resolved_state,
            reason=str(error),
        )


@app.get("/", include_in_schema=False)
def frontend() -> FileResponse:
    return FileResponse(BASE_DIR / "app" / "static" / "index.html")


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        building_model_loaded=yolo_service.is_model_loaded("building"),
        road_model_loaded=yolo_service.is_model_loaded("road"),
        gemini_vision_enabled=settings.use_gemini_vision_analysis,
        gemini_configured=bool(settings.gemini_api_key),
    )


@app.get("/api/locations/states")
def location_states() -> dict[str, list[dict[str, str]]]:
    return {"states": get_state_options()}


@app.get("/api/locations/cities")
def location_cities(state: str) -> dict[str, str | list[str]]:
    try:
        state_code, cities, source = get_cities_for_state(state)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return {
        "state": state_code,
        "cities": cities,
        "source": source,
    }


@app.post("/api/inspect", response_model=InspectionResponse)
async def inspect_image(
    file: Annotated[UploadFile, File(...)],
    inspection_type: Annotated[InspectionType, Form()] = InspectionType.auto,
    city: Annotated[str | None, Form()] = None,
    state: Annotated[str | None, Form()] = None,
) -> InspectionResponse:
    saved_path = await run_in_threadpool(save_upload_file, file, settings.upload_dir)
    try:
        await run_in_threadpool(validate_image_file, saved_path)
    except InvalidImageError as error:
        remove_file_if_exists(saved_path)
        raise HTTPException(status_code=400, detail=str(error)) from error

    analysis_engine = "gemini_vision"
    analysis_notes = None
    if settings.use_gemini_vision_analysis:
        try:
            gemini_result = await run_in_threadpool(
                gemini_vision_service.inspect_image,
                saved_path,
                inspection_type.value,
                settings.confidence_threshold,
            )
            yolo_result = gemini_result.inspection
            analysis_notes = gemini_result.notes
        except GeminiVisionError as error:
            analysis_engine = "yolo"
            analysis_notes = f"Gemini vision failed, used YOLO fallback: {error}"
            try:
                yolo_result = await run_in_threadpool(
                    yolo_service.inspect_image,
                    saved_path,
                    inspection_type.value,
                    settings.confidence_threshold,
                )
            except ModelUnavailableError as nested_error:
                raise HTTPException(status_code=503, detail=str(nested_error)) from nested_error
            except DetectionRuntimeError as nested_error:
                raise HTTPException(status_code=500, detail=str(nested_error)) from nested_error
    else:
        analysis_engine = "yolo"
        try:
            yolo_result = await run_in_threadpool(
                yolo_service.inspect_image,
                saved_path,
                inspection_type.value,
                settings.confidence_threshold,
            )
        except ModelUnavailableError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except DetectionRuntimeError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    aggregates = build_aggregates(yolo_result.detections)
    assessment = score_detections(
        yolo_result.inspection_type,
        yolo_result.detections,
        aggregates,
    )
    resolved_location = resolve_inspection_location(city, state)
    resolved_city, resolved_state = resolved_location if resolved_location else (None, None)
    location = {
        "city": resolved_city,
        "state": resolved_state,
    }
    search_terms = build_local_business_search_terms(
        yolo_result.inspection_type,
        yolo_result.detections,
        city=resolved_city,
        state=resolved_state,
    )
    local_businesses, gemini_report = await asyncio.gather(
        _fetch_local_businesses(
            resolved_city=resolved_city,
            resolved_state=resolved_state,
            inspection_type=yolo_result.inspection_type,
            detections=yolo_result.detections,
        ),
        _fetch_gemini_report(
            inspection_type=yolo_result.inspection_type,
            detections=yolo_result.detections,
            aggregates=aggregates,
            assessment=assessment,
            location=location,
            search_terms=search_terms,
            resolved_city=resolved_city,
            resolved_state=resolved_state,
        ),
    )

    annotated_path = yolo_result.annotated_image_path
    annotated_url = upload_url_for(annotated_path, settings.upload_dir) if annotated_path else None

    return InspectionResponse(
        analysis_engine=analysis_engine,
        analysis_notes=analysis_notes,
        inspection_type=yolo_result.inspection_type,
        image_filename=saved_path.name,
        detections=yolo_result.detections,
        aggregates=aggregates,
        computed_assessment=assessment,
        gemini_report=gemini_report,
        local_businesses=local_businesses,
        annotated_image_path=str(annotated_path) if annotated_path else None,
        annotated_image_url=annotated_url,
    )
