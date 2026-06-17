from __future__ import annotations

from collections import Counter

from app.models.schemas import Aggregates, ComputedAssessment, DamageDetection


ROAD_DAMAGE_SCORES = {
    "crack": 1.5,
    "pothole": 2.0,
    "road_blockage": 2.5,
    "debris": 1.5,
    "traffic_cone": 0.8,
    "stalled_vehicle": 2.5,
}

BUILDING_DAMAGE_SCORES = {
    "crack": 1.5,
    "leakage": 1.7,
    "corrosion": 1.8,
    "abscission": 1.6,
    "bulge": 2.0,
}

TIMEFRAMES = {
    "Low": "Fix within 60-90 days",
    "Medium": "Fix within 30-60 days",
    "High": "Fix within 7-14 days",
    "Critical": "Fix within 1-3 days",
}


def build_aggregates(detections: list[DamageDetection]) -> Aggregates:
    counts = Counter(d.damage_type for d in detections)
    total = len(detections)
    average_confidence = (
        round(sum(d.confidence for d in detections) / total, 4) if total else 0.0
    )
    return Aggregates(
        total_detections=total,
        damage_counts=dict(counts),
        average_confidence=average_confidence,
    )


def score_detections(
    inspection_type: str,
    detections: list[DamageDetection],
    aggregates: Aggregates,
) -> ComputedAssessment:
    score_map = BUILDING_DAMAGE_SCORES if inspection_type == "building" else ROAD_DAMAGE_SCORES
    score = sum(score_map.get(d.damage_type, 1.0) for d in detections)
    total_area_pixels = sum(d.estimated_area_pixels for d in detections)

    if aggregates.average_confidence > 0.8:
        score += 0.5
    if aggregates.total_detections > 5:
        score += 1.0
    if any(d.severity_hint == "high" for d in detections):
        score += 1.0
    elif any(d.severity_hint == "medium" for d in detections):
        score += 0.5

    if inspection_type == "building":
        if total_area_pixels >= 2_000_000:
            score += 1.5
        elif total_area_pixels >= 600_000:
            score += 0.75
    else:
        if total_area_pixels >= 750_000:
            score += 1.5
        elif total_area_pixels >= 250_000:
            score += 0.75

    severity_score = round(max(0.0, min(10.0, score)), 2)
    priority = _priority_for_score(severity_score)
    return ComputedAssessment(
        severity_score=severity_score,
        priority=priority,
        recommended_timeframe=TIMEFRAMES[priority],
    )


def detection_severity_hint(
    inspection_type: str,
    damage_type: str,
    confidence: float,
) -> str:
    score_map = BUILDING_DAMAGE_SCORES if inspection_type == "building" else ROAD_DAMAGE_SCORES
    weighted_score = score_map.get(damage_type, 1.0) * max(confidence, 0.25)

    if weighted_score >= 1.6:
        return "high"
    if weighted_score >= 0.9:
        return "medium"
    return "low"


def _priority_for_score(score: float) -> str:
    if score < 3:
        return "Low"
    if score < 6:
        return "Medium"
    if score < 8:
        return "High"
    return "Critical"
