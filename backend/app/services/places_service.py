from __future__ import annotations

import re
import time
from html import unescape
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx

from app.models.schemas import DamageDetection, LocalBusiness


GOOGLE_PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DUCKDUCKGO_HTML_SEARCH_URL = "https://duckduckgo.com/html/"
NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "InfraVisionAI/1.0 local hackathon backend"
SKIPPED_SEARCH_DOMAINS = {
    "angi.com",
    "bbb.org",
    "facebook.com",
    "homeadvisor.com",
    "homeguide.com",
    "linkedin.com",
    "mapquest.com",
    "thumbtack.com",
    "yelp.com",
    "yellowpages.com",
}
GOOGLE_PLACES_FIELD_MASK = (
    "places.displayName,"
    "places.formattedAddress,"
    "places.nationalPhoneNumber,"
    "places.websiteUri,"
    "places.googleMapsUri,"
    "places.rating,"
    "places.userRatingCount"
)


def build_local_business_search_terms(
    inspection_type: str,
    detections: list[DamageDetection],
    city: str | None = None,
    state: str | None = None,
) -> list[str]:
    location = _format_city_state(city, state)
    near_clause = f" near {location}" if location else " near city state"

    damage_types = {d.damage_type for d in detections}
    if inspection_type == "road":
        terms = [
            f"asphalt repair contractor{near_clause}",
            f"asphalt paving contractor{near_clause}",
            f"road crack sealing service{near_clause}",
        ]
        if "pothole" in damage_types:
            terms.insert(1, f"pothole repair contractor{near_clause}")
    else:
        terms = [
            f"building repair contractor{near_clause}",
            f"structural crack repair contractor{near_clause}",
            f"concrete repair contractor{near_clause}",
        ]
        if "leakage" in damage_types:
            terms.append(f"water leakage repair service{near_clause}")

    if "corrosion" in damage_types:
        terms.append(f"corrosion remediation contractor{near_clause}")
    if "road_blockage" in damage_types or "debris" in damage_types:
        terms.append(f"road debris removal service{near_clause}")

    return list(dict.fromkeys(terms))


def find_local_businesses(
    *,
    inspection_type: str,
    detections: list[DamageDetection],
    api_key: str,
    city: str | None = None,
    state: str | None = None,
    max_results: int = 5,
) -> list[LocalBusiness]:
    location = _format_city_state(city, state)
    if not location:
        return []

    search_terms = build_local_business_search_terms(
        inspection_type,
        detections,
        city=city,
        state=state,
    )

    if not api_key:
        web_results = _search_web_businesses(search_terms, max_results=max_results)
        if web_results:
            return web_results

        osm_results = _search_openstreetmap_businesses(search_terms, max_results=max_results)
        if osm_results:
            return osm_results
        return _fallback_business_links(
            search_terms,
            note="No OpenStreetMap business results found. Add GOOGLE_PLACES_API_KEY to .env for stronger business search.",
            max_results=max_results,
        )

    results: list[LocalBusiness] = []
    seen: set[str] = set()

    for term in search_terms[:3]:
        try:
            places = _search_google_places(
                term=term,
                api_key=api_key,
            )
        except Exception:
            continue

        for place in places:
            business = _place_to_business(place, term)
            dedupe_key = f"{business.name}|{business.address}".lower()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            results.append(business)
            if len(results) >= max_results:
                return results

    if results:
        return results

    web_results = _search_web_businesses(search_terms, max_results=max_results)
    if web_results:
        return web_results

    osm_results = _search_openstreetmap_businesses(search_terms, max_results=max_results)
    if osm_results:
        return osm_results

    return _fallback_business_links(
        search_terms,
        note="Google Places and OpenStreetMap returned no businesses for this query.",
        max_results=max_results,
    )


def _format_city_state(city: str | None, state: str | None) -> str:
    clean_city = (city or "").strip()
    clean_state = (state or "").strip()
    if not clean_city or not clean_state:
        return ""
    return f"{clean_city} {clean_state}"


def _search_google_places(
    *,
    term: str,
    api_key: str,
) -> list[dict]:
    payload: dict = {
        "textQuery": term,
        "maxResultCount": 3,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.post(
            GOOGLE_PLACES_TEXT_SEARCH_URL,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    return data.get("places", [])


def _place_to_business(place: dict, search_term: str) -> LocalBusiness:
    display_name = place.get("displayName") or {}
    name = display_name.get("text") or "Unnamed business"
    return LocalBusiness(
        name=name,
        search_term=search_term,
        source="google_places",
        address=place.get("formattedAddress"),
        phone=place.get("nationalPhoneNumber"),
        website=place.get("websiteUri"),
        maps_url=place.get("googleMapsUri"),
        rating=place.get("rating"),
        user_rating_count=place.get("userRatingCount"),
    )


def _search_web_businesses(
    search_terms: list[str],
    *,
    max_results: int,
) -> list[LocalBusiness]:
    results: list[LocalBusiness] = []
    seen_hosts: set[str] = set()
    seen_names: set[str] = set()

    for term in search_terms[:3]:
        try:
            entries = _search_duckduckgo(term)
        except Exception:
            continue

        for title, url in entries:
            host = _normalized_host(url)
            if not host or host in seen_hosts or _is_skipped_search_host(host):
                continue

            name = _clean_search_title(title)
            if not name or name.lower() in seen_names:
                continue

            seen_hosts.add(host)
            seen_names.add(name.lower())
            results.append(
                LocalBusiness(
                    name=name,
                    search_term=term,
                    source="web_search",
                    website=url,
                    maps_url=url,
                    note="Web search result. Verify service fit, licensing, and availability before contacting.",
                )
            )
            if len(results) >= max_results:
                return results

    return results


def _search_duckduckgo(term: str) -> list[tuple[str, str]]:
    headers = {
        "User-Agent": NOMINATIM_USER_AGENT,
    }
    with httpx.Client(timeout=12.0, headers=headers, follow_redirects=True) as client:
        response = client.get(DUCKDUCKGO_HTML_SEARCH_URL, params={"q": term})
        response.raise_for_status()

    entries: list[tuple[str, str]] = []
    for match in re.finditer(
        r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        response.text,
        re.IGNORECASE | re.DOTALL,
    ):
        raw_url = unescape(match.group(1))
        raw_title = re.sub(r"<.*?>", "", match.group(2))
        title = unescape(raw_title).strip()
        url = _resolve_duckduckgo_url(raw_url)
        if title and url:
            entries.append((title, url))

    return entries


def _resolve_duckduckgo_url(raw_url: str) -> str:
    if raw_url.startswith("//"):
        raw_url = f"https:{raw_url}"

    parsed = urlparse(raw_url)
    if "duckduckgo.com" in parsed.netloc:
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        if target:
            return unquote(target)

    return raw_url


def _normalized_host(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _is_skipped_search_host(host: str) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in SKIPPED_SEARCH_DOMAINS)


def _clean_search_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s*\.\.\.$", "", title).strip()
    return title


def _search_openstreetmap_businesses(
    search_terms: list[str],
    *,
    max_results: int,
) -> list[LocalBusiness]:
    results: list[LocalBusiness] = []
    seen: set[str] = set()

    for index, term in enumerate(search_terms[:3]):
        if index:
            time.sleep(1.1)

        try:
            places = _search_nominatim(term)
        except Exception:
            continue

        for place in places:
            business = _nominatim_place_to_business(place, term)
            if not business.name or business.name.lower() in {"unknown", "unnamed business"}:
                continue
            dedupe_key = f"{business.name}|{business.address}".lower()
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            results.append(business)
            if len(results) >= max_results:
                return results

    return results


def _search_nominatim(term: str) -> list[dict]:
    params = {
        "q": term,
        "format": "jsonv2",
        "addressdetails": 1,
        "limit": 4,
    }
    headers = {
        "User-Agent": NOMINATIM_USER_AGENT,
    }

    with httpx.Client(timeout=10.0, headers=headers) as client:
        response = client.get(NOMINATIM_SEARCH_URL, params=params)
        response.raise_for_status()
        return response.json()


def _nominatim_place_to_business(place: dict, search_term: str) -> LocalBusiness:
    display_name = place.get("display_name") or "Unnamed business"
    name = place.get("name") or display_name.split(",", 1)[0].strip() or "Unnamed business"
    osm_type = (place.get("osm_type") or "").lower()
    osm_id = place.get("osm_id")
    lat = place.get("lat")
    lon = place.get("lon")

    if osm_type and osm_id:
        maps_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
    elif lat and lon:
        maps_url = f"https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=16/{lat}/{lon}"
    else:
        maps_url = f"https://www.openstreetmap.org/search?query={quote_plus(search_term)}"

    return LocalBusiness(
        name=name,
        search_term=search_term,
        source="openstreetmap",
        address=display_name,
        maps_url=maps_url,
        note="OpenStreetMap result. Verify service fit, licensing, and availability before contacting.",
    )


def _fallback_business_links(
    search_terms: list[str],
    *,
    note: str,
    max_results: int,
) -> list[LocalBusiness]:
    businesses: list[LocalBusiness] = []
    for term in search_terms[:max_results]:
        businesses.append(
            LocalBusiness(
                name=f"Search Google Maps: {term}",
                search_term=term,
                source="search_term",
                maps_url=f"https://www.google.com/maps/search/?api=1&query={quote_plus(term)}",
                note=note,
            )
        )
    return businesses
