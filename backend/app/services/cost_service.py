from __future__ import annotations

import math

from app.models.schemas import ComputedAssessment, DamageDetection


ROAD_AREA_UNIT_COSTS = {
    "Low": (250, 750),
    "Medium": (700, 1800),
    "High": (1500, 4200),
    "Critical": (3500, 9000),
}

BUILDING_AREA_UNIT_COSTS = {
    "Low": (150, 350),
    "Medium": (350, 900),
    "High": (900, 2500),
    "Critical": (2200, 6000),
}

MOBILIZATION_COSTS = {
    "road": (300, 1000),
    "building": (300, 800),
}

PRIORITY_COST_CAPS = {
    "road": {
        "Low": (300, 2500),
        "Medium": (1000, 7500),
        "High": (3500, 18000),
        "Critical": (8000, 45000),
    },
    "building": {
        "Low": (400, 2000),
        "Medium": (1200, 6500),
        "High": (4000, 18000),
        "Critical": (10000, 45000),
    },
}

STATE_COST_MULTIPLIERS = {
    "CA": 1.25,
    "NY": 1.2,
    "MA": 1.15,
    "WA": 1.15,
    "NJ": 1.12,
    "CT": 1.12,
    "DC": 1.2,
    "HI": 1.25,
    "AK": 1.18,
    "MS": 0.9,
    "AL": 0.92,
    "AR": 0.92,
    "OK": 0.94,
    "WV": 0.94,
    "KY": 0.95,
}

CITY_COST_MULTIPLIERS = {
    "new york": 1.35,
    "san francisco": 1.35,
    "los angeles": 1.25,
    "seattle": 1.18,
    "boston": 1.18,
    "washington": 1.18,
    "chicago": 1.12,
    "atlanta": 1.05,
    "miami": 1.08,
    "houston": 1.02,
    "dallas": 1.02,
}


def estimate_cost_range(
    inspection_type: str,
    assessment: ComputedAssessment,
    detections: list[DamageDetection],
    *,
    city: str | None = None,
    state: str | None = None,
) -> tuple[str, str]:
    detection_count = len(detections)
    total_area_pixels = sum(d.estimated_area_pixels for d in detections)
    if detection_count == 0 or total_area_pixels <= 0:
        return (
            "$0 - $500",
            "No confident damage area was detected. Cost is limited to a possible manual inspection or recheck allowance.",
        )

    area_units = _estimate_repair_area_units(
        inspection_type,
        assessment,
        detections,
        total_area_pixels,
    )
    cost_table = BUILDING_AREA_UNIT_COSTS if inspection_type == "building" else ROAD_AREA_UNIT_COSTS
    unit_low, unit_high = cost_table[assessment.priority]
    mobilization_low, mobilization_high = MOBILIZATION_COSTS[inspection_type]

    low = mobilization_low + area_units * unit_low
    high = mobilization_high + area_units * unit_high
    if detection_count > 5:
        high = int(high * 1.15)

    location_multiplier = _location_cost_multiplier(city, state)
    low = int(low * location_multiplier)
    high = int(high * location_multiplier)

    cap_low, cap_high = PRIORITY_COST_CAPS[inspection_type][assessment.priority]
    cap_low = int(cap_low * location_multiplier)
    cap_high = int(cap_high * location_multiplier)
    low = min(max(low, cap_low), cap_high)
    high = min(max(high, low + 500), cap_high)

    low = int(round(low, -2))
    high = int(round(high, -2))
    if high <= low:
        low = max(cap_low, low - 500)
        high = min(cap_high, low + 500)
    cost_range = f"${low:,.0f} - ${high:,.0f}"
    reasoning = (
        f"Estimated from inspection type, severity priority, and detected area proxy. "
        f"The model found {detection_count} confident detection(s) covering about "
        f"{total_area_pixels:,} bounding-box pixels, which maps to {area_units} repair area unit(s). "
        f"A {location_multiplier:.2f} local cost multiplier was applied from the supplied city/state. "
        "This is not a quote and should be validated by a licensed local contractor."
    )
    return cost_range, reasoning


def _estimate_repair_area_units(
    inspection_type: str,
    assessment: ComputedAssessment,
    detections: list[DamageDetection],
    total_area_pixels: int,
) -> int:
    area_unit_pixels = 50_000 if inspection_type == "road" else 120_000
    raw_area_units = max(1, math.ceil(total_area_pixels / area_unit_pixels))

    if inspection_type == "building" and all(d.damage_type == "crack" for d in detections):
        # Crack boxes often include a lot of undamaged wall around a thin line.
        # Square-root scaling keeps that proxy from becoming a fake facade replacement estimate.
        raw_area_units = max(1, math.ceil(math.sqrt(raw_area_units)))

    max_area_units = 12 if assessment.priority == "Low" else 20
    return max(1, min(max_area_units, raw_area_units))


def _location_cost_multiplier(city: str | None, state: str | None) -> float:
    multiplier = 1.0
    if state:
        multiplier *= STATE_COST_MULTIPLIERS.get(state.strip().upper(), 1.0)
    if city:
        multiplier *= CITY_COST_MULTIPLIERS.get(city.strip().lower(), 1.0)
    return max(0.85, min(1.4, multiplier))
