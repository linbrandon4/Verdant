from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class InspectionType(str, Enum):
    auto = "auto"
    road = "road"
    building = "building"


class DamageDetection(BaseModel):
    damage_type: str
    confidence: float = Field(ge=0, le=1)
    bbox: list[float] = Field(min_length=4, max_length=4)
    estimated_area_pixels: int = Field(ge=0)
    severity_hint: Literal["low", "medium", "high"]


class Aggregates(BaseModel):
    total_detections: int = Field(ge=0)
    damage_counts: dict[str, int]
    average_confidence: float = Field(ge=0, le=1)


class ComputedAssessment(BaseModel):
    severity_score: float = Field(ge=0, le=10)
    priority: Literal["Low", "Medium", "High", "Critical"]
    recommended_timeframe: str


class GeminiReport(BaseModel):
    estimated_cost_range: str
    cost_reasoning: str
    traditional_solution: str
    sustainable_solution: str
    sustainability_comparison: str
    estimated_avoided_material_waste: Literal["Low", "Medium", "High"]
    estimated_carbon_savings: Literal["Low", "Medium", "High"]
    impact_analogy: str
    recommended_timeframe: str
    local_business_search_terms: list[str]
    summary: str
    disclaimer: str


class LocalBusiness(BaseModel):
    name: str
    search_term: str
    source: Literal["google_places", "web_search", "openstreetmap", "search_term", "gemini_search"]
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    maps_url: str | None = None
    rating: float | None = None
    user_rating_count: int | None = None
    note: str | None = None


class InspectionResponse(BaseModel):
    analysis_engine: Literal["gemini_vision", "yolo"]
    analysis_notes: str | None = None
    inspection_type: Literal["road", "building"]
    image_filename: str
    detections: list[DamageDetection]
    aggregates: Aggregates
    computed_assessment: ComputedAssessment
    gemini_report: GeminiReport
    local_businesses: list[LocalBusiness] = Field(default_factory=list)
    annotated_image_path: str | None = None
    annotated_image_url: str | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    building_model_loaded: bool
    road_model_loaded: bool
    gemini_vision_enabled: bool
    gemini_configured: bool
