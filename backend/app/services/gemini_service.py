from __future__ import annotations

import json
import math
from typing import Any

from app.config import Settings
from app.models.schemas import Aggregates, ComputedAssessment, DamageDetection, GeminiReport
from app.services.cost_service import estimate_cost_range
from app.services.places_service import build_local_business_search_terms


SYSTEM_INSTRUCTION = (
    "You are an infrastructure sustainability analyst. You receive computer vision "
    "damage detections from roads or buildings. Generate a practical repair and "
    "sustainability report. Do not invent exact measurements that were not provided. "
    "When estimates are uncertain, give ranges and label them as estimates. Return "
    "only valid JSON."
)


class GeminiReportError(RuntimeError):
    pass


class GeminiService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def generate_report(
        self,
        *,
        inspection_type: str,
        detections: list[DamageDetection],
        aggregates: Aggregates,
        assessment: ComputedAssessment,
        location: dict[str, Any],
        search_terms: list[str],
    ) -> GeminiReport:
        if not self.settings.gemini_api_key:
            raise GeminiReportError("GEMINI_API_KEY is not configured.")

        cost_range, cost_reasoning = estimate_cost_range(
            inspection_type,
            assessment,
            detections,
            city=location.get("city"),
            state=location.get("state"),
        )
        total_area_pixels = sum(d.estimated_area_pixels for d in detections)
        prompt_payload = {
            "inspection_type": inspection_type,
            "location": location,
            "detections": [d.model_dump() for d in detections],
            "aggregates": aggregates.model_dump(),
            "total_detected_area_pixels": total_area_pixels,
            "area_based_cost_estimate": {
                "estimated_cost_range": cost_range,
                "cost_reasoning": cost_reasoning,
            },
            "computed_severity_score": assessment.severity_score,
            "priority": assessment.priority,
            "recommended_timeframe": assessment.recommended_timeframe,
            "local_business_search_terms": search_terms,
            "output_schema": GeminiReport.model_json_schema(),
        }

        prompt = (
            "Generate the repair and sustainability report from this structured JSON. "
            "Use the provided area_based_cost_estimate for estimated_cost_range and cost_reasoning. "
            "Use the supplied search terms when relevant. Include a traditional-vs-sustainable "
            "comparison. For estimated_avoided_material_waste and estimated_carbon_savings, return "
            "exactly one of these categorical values: Low, Medium, or High. Use impact_analogy for "
            "a short tree-year CO2 absorption analogy. Clearly label estimates as planning estimates "
            "because the input contains image detections, not field measurements. "
            "Return only the report JSON.\n\n"
            f"{json.dumps(prompt_payload, indent=2)}"
        )

        try:
            response_text = self._generate_with_mime_schema(prompt)
        except Exception as mime_schema_error:
            if not self._is_sdk_config_compatibility_error(mime_schema_error):
                raise GeminiReportError(f"Gemini request failed: {mime_schema_error}") from mime_schema_error

            try:
                response_text = self._generate_with_response_format(prompt)
            except Exception as response_format_error:
                raise GeminiReportError(
                    "Gemini request failed: "
                    f"{mime_schema_error}; response_format attempt failed: {response_format_error}"
                ) from response_format_error

        try:
            report = GeminiReport.model_validate_json(response_text)
        except Exception as error:
            try:
                report = GeminiReport.model_validate(json.loads(response_text))
            except Exception as nested_error:
                raise GeminiReportError(
                    f"Gemini returned invalid report JSON: {nested_error}"
                ) from error

        report.estimated_cost_range = cost_range
        report.cost_reasoning = cost_reasoning
        return report

    def _generate_with_response_format(self, prompt: str) -> str:
        from google import genai

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config={
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "response_format": {
                        "text": {
                            "mime_type": "application/json",
                            "schema": GeminiReport.model_json_schema(),
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

    def _generate_with_mime_schema(self, prompt: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    response_schema=GeminiReport,
                ),
            )
            return response.text or "{}"
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()


def build_fallback_report(
    *,
    inspection_type: str,
    detections: list[DamageDetection],
    assessment: ComputedAssessment,
    city: str | None = None,
    state: str | None = None,
    reason: str = "Gemini report unavailable.",
) -> GeminiReport:
    cost_range, cost_reasoning = estimate_cost_range(
        inspection_type,
        assessment,
        detections,
        city=city,
        state=state,
    )
    search_terms = build_local_business_search_terms(
        inspection_type, detections, city=city, state=state
    )
    damage_types = sorted({d.damage_type for d in detections})
    damage_summary = ", ".join(damage_types) if damage_types else "no confident damage detections"

    if inspection_type == "road":
        traditional_solution = "Standard asphalt patching, crack sealing, lane control, and debris removal as applicable."
        sustainable_solution = "Prioritize targeted repair, recycled asphalt mix where available, and staged maintenance to reduce material use."
    else:
        traditional_solution = "Conventional patching, sealant application, corrosion treatment, and facade or envelope repair as applicable."
        sustainable_solution = "Prioritize targeted remediation, low-VOC sealants, corrosion inhibitors, and repair-first material reuse where safe."

    sustainability_metrics = _estimate_sustainability_metrics(
        inspection_type=inspection_type,
        detections=detections,
        assessment=assessment,
    )

    return GeminiReport(
        estimated_cost_range=cost_range,
        cost_reasoning=cost_reasoning,
        traditional_solution=traditional_solution,
        sustainable_solution=sustainable_solution,
        sustainability_comparison=sustainability_metrics["comparison"],
        estimated_avoided_material_waste=sustainability_metrics["material_waste"],
        estimated_carbon_savings=sustainability_metrics["carbon_savings"],
        impact_analogy=sustainability_metrics["impact_analogy"],
        recommended_timeframe=assessment.recommended_timeframe,
        local_business_search_terms=search_terms,
        summary=(
            f"Detected {len(detections)} item(s) for a {inspection_type} inspection: "
            f"{damage_summary}. Priority is {assessment.priority} with severity score "
            f"{assessment.severity_score}."
        ),
        disclaimer=f"Fallback report generated locally. {reason}",
    )


def _estimate_sustainability_metrics(
    *,
    inspection_type: str,
    detections: list[DamageDetection],
    assessment: ComputedAssessment,
) -> dict[str, str]:
    detection_count = len(detections)
    total_area_pixels = sum(d.estimated_area_pixels for d in detections)
    if detection_count == 0:
        return {
            "comparison": (
                "No confident damage was detected. Avoiding unnecessary repair work is the lowest-waste option; "
                "reinspect or verify manually before ordering materials."
            ),
            "material_waste": "Low",
            "carbon_savings": "Low",
            "impact_analogy": "Estimated impact is less than 1 mature-tree year of CO2 absorption.",
        }

    area_unit_pixels = 50_000 if inspection_type == "road" else 120_000
    raw_area_units = max(1, math.ceil(total_area_pixels / area_unit_pixels))
    if inspection_type == "building" and all(d.damage_type == "crack" for d in detections):
        raw_area_units = max(1, math.ceil(math.sqrt(raw_area_units)))
    area_units = max(1, min(10, raw_area_units))
    severity_units = max(1, min(5, round(assessment.severity_score / 2)))
    repair_units = max(detection_count, area_units, severity_units)

    if inspection_type == "road":
        material_low = repair_units * 120
        material_high = repair_units * 275
        carbon_low = repair_units * 35
        carbon_high = repair_units * 85
        comparison = (
            "Compared with broad asphalt removal and replacement, targeted crack sealing or pothole patching "
            "with recycled asphalt can reduce virgin aggregate demand, hauling, and disposal volume."
        )
    else:
        material_low = repair_units * 75
        material_high = repair_units * 180
        carbon_low = repair_units * 25
        carbon_high = repair_units * 70
        comparison = (
            "Compared with full facade or envelope replacement, targeted crack repair with low-VOC sealants "
            "and repair-first material reuse can reduce demolition waste and new material demand."
        )

    tree_low = max(1, round(carbon_low / 22))
    tree_high = max(tree_low, round(carbon_high / 22))
    material_level = _cap_impact_level_by_priority(
        _impact_level(material_high, low_threshold=350, high_threshold=900),
        assessment.priority,
    )
    carbon_level = _cap_impact_level_by_priority(
        _impact_level(carbon_high, low_threshold=125, high_threshold=350),
        assessment.priority,
    )

    return {
        "comparison": (
            f"{comparison} These are planning estimates based on {detection_count} confident detection(s), "
            f"severity score {assessment.severity_score}, and bounding-box area proxy {total_area_pixels:,} pixels."
        ),
        "material_waste": material_level,
        "carbon_savings": carbon_level,
        "impact_analogy": (
            f"Approximate climate analogy: {tree_low}-{tree_high} mature-tree years of CO2 absorption."
        ),
    }


def _impact_level(value: int, *, low_threshold: int, high_threshold: int) -> str:
    if value < low_threshold:
        return "Low"
    if value < high_threshold:
        return "Medium"
    return "High"


def _cap_impact_level_by_priority(level: str, priority: str) -> str:
    if priority == "Low":
        return "Low"
    if priority == "Medium" and level == "High":
        return "Medium"
    return level
