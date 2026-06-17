from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from app.config import Settings
from app.models.schemas import DamageDetection, LocalBusiness
from app.services.places_service import build_local_business_search_terms


BUSINESS_SYSTEM_INSTRUCTION = (
    "You are a local contractor research assistant for infrastructure repair. "
    "Use Google Search to find real, currently operating businesses near the requested city. "
    "Prefer contractors with websites, phone numbers, or Google Maps listings. "
    "Do not invent businesses. Return only valid JSON."
)


class GeminiBusinessItem(BaseModel):
    name: str
    specialty: str = ""
    address: str | None = None
    phone: str | None = None
    website: str | None = None
    maps_url: str | None = None


class GeminiBusinessPayload(BaseModel):
    businesses: list[GeminiBusinessItem] = Field(default_factory=list)


class GeminiBusinessSearchError(RuntimeError):
    pass


class GeminiBusinessService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def find_local_businesses(
        self,
        *,
        inspection_type: str,
        detections: list[DamageDetection],
        city: str,
        state: str,
        max_results: int = 4,
    ) -> list[LocalBusiness]:
        if not self.settings.gemini_api_key:
            raise GeminiBusinessSearchError("GEMINI_API_KEY is not configured.")

        damage_types = sorted({d.damage_type for d in detections})
        damage_summary = ", ".join(damage_types) if damage_types else "general infrastructure wear"
        search_terms = build_local_business_search_terms(
            inspection_type,
            detections,
            city=city,
            state=state,
        )

        prompt = (
            f"Find up to {max_results} real local contractors or repair companies near "
            f"{city}, {state} that can help with a {inspection_type} inspection involving "
            f"{damage_summary}.\n"
            f"Suggested search angles: {', '.join(search_terms[:3])}.\n"
            "Return JSON with this shape:\n"
            '{"businesses":[{"name":"Company","specialty":"short service focus",'
            '"address":"street, city, state","phone":"phone","website":"https://...",'
            '"maps_url":"https://maps.google.com/..."}]}\n'
            "Only include businesses you can verify through search."
        )

        try:
            try:
                response_text = self._generate_with_search(prompt)
            except Exception as error:
                if not self._is_tool_schema_error(error):
                    raise GeminiBusinessSearchError(
                        f"Gemini business search failed: {error}"
                    ) from error
                response_text = self._generate_with_search_plain(prompt)

            payload = _parse_payload(response_text)
            businesses = _normalize_businesses(payload.businesses, max_results=max_results)
            if not businesses:
                raise GeminiBusinessSearchError("Gemini returned no businesses.")
            return businesses
        except GeminiBusinessSearchError:
            raise
        except Exception as error:
            raise GeminiBusinessSearchError(f"Gemini business search failed: {error}") from error

    def _generate_with_search(self, prompt: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=BUSINESS_SYSTEM_INSTRUCTION,
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                    response_mime_type="application/json",
                    response_schema=GeminiBusinessPayload,
                ),
            )
            return response.text or "{}"
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    def _generate_with_search_plain(self, prompt: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)
        try:
            response = client.models.generate_content(
                model=self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=BUSINESS_SYSTEM_INSTRUCTION,
                    tools=[types.Tool(google_search=types.GoogleSearch())],
                ),
            )
            return response.text or "{}"
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    def _is_tool_schema_error(self, error: Exception) -> bool:
        message = str(error).lower()
        return (
            "response_mime_type" in message
            or "response_schema" in message
            or "tool" in message
            or "google_search" in message
        )


def _parse_payload(response_text: str) -> GeminiBusinessPayload:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return GeminiBusinessPayload.model_validate_json(cleaned)
    except Exception:
        try:
            return GeminiBusinessPayload.model_validate(json.loads(cleaned))
        except Exception:
            return _parse_loose_businesses(cleaned)


def _parse_loose_businesses(text: str) -> GeminiBusinessPayload:
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        raise GeminiBusinessSearchError("Gemini returned invalid business JSON.")
    payload = json.loads(match.group(0))
    if isinstance(payload, list):
        return GeminiBusinessPayload(businesses=payload)
    if "businesses" in payload:
        return GeminiBusinessPayload.model_validate(payload)
    raise GeminiBusinessSearchError("Gemini returned invalid business JSON.")


def _normalize_businesses(
    items: list[GeminiBusinessItem],
    *,
    max_results: int,
) -> list[LocalBusiness]:
    results: list[LocalBusiness] = []
    seen: set[str] = set()

    for item in items:
        name = item.name.strip()
        if not name:
            continue

        dedupe_key = name.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        website = _clean_url(item.website)
        maps_url = _clean_url(item.maps_url)
        url = website or maps_url

        results.append(
            LocalBusiness(
                name=name,
                search_term=item.specialty.strip() or name,
                source="gemini_search",
                address=item.address.strip() if item.address else None,
                phone=_clean_phone(item.phone),
                website=website,
                maps_url=maps_url or url,
                note=item.specialty.strip() or None,
            )
        )
        if len(results) >= max_results:
            break

    return results


def _clean_url(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if cleaned.startswith("//"):
        cleaned = f"https:{cleaned}"
    if not cleaned.startswith(("http://", "https://")):
        cleaned = f"https://{cleaned}"
    return cleaned


def _clean_phone(value: str | None) -> str | None:
    if not value:
        return None
    cleaned = re.sub(r"[^\d+().\-\s]", "", value).strip()
    return cleaned or None
