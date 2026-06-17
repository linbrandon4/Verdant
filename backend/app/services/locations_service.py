from __future__ import annotations

import csv
import io
import re
from threading import Lock

import httpx


CITY_DATA_URL = "https://raw.githubusercontent.com/kelvins/US-Cities-Database/main/csv/us_cities.csv"

STATE_OPTIONS = [
    {"code": "AL", "name": "Alabama"},
    {"code": "AK", "name": "Alaska"},
    {"code": "AZ", "name": "Arizona"},
    {"code": "AR", "name": "Arkansas"},
    {"code": "CA", "name": "California"},
    {"code": "CO", "name": "Colorado"},
    {"code": "CT", "name": "Connecticut"},
    {"code": "DE", "name": "Delaware"},
    {"code": "FL", "name": "Florida"},
    {"code": "GA", "name": "Georgia"},
    {"code": "HI", "name": "Hawaii"},
    {"code": "ID", "name": "Idaho"},
    {"code": "IL", "name": "Illinois"},
    {"code": "IN", "name": "Indiana"},
    {"code": "IA", "name": "Iowa"},
    {"code": "KS", "name": "Kansas"},
    {"code": "KY", "name": "Kentucky"},
    {"code": "LA", "name": "Louisiana"},
    {"code": "ME", "name": "Maine"},
    {"code": "MD", "name": "Maryland"},
    {"code": "MA", "name": "Massachusetts"},
    {"code": "MI", "name": "Michigan"},
    {"code": "MN", "name": "Minnesota"},
    {"code": "MS", "name": "Mississippi"},
    {"code": "MO", "name": "Missouri"},
    {"code": "MT", "name": "Montana"},
    {"code": "NE", "name": "Nebraska"},
    {"code": "NV", "name": "Nevada"},
    {"code": "NH", "name": "New Hampshire"},
    {"code": "NJ", "name": "New Jersey"},
    {"code": "NM", "name": "New Mexico"},
    {"code": "NY", "name": "New York"},
    {"code": "NC", "name": "North Carolina"},
    {"code": "ND", "name": "North Dakota"},
    {"code": "OH", "name": "Ohio"},
    {"code": "OK", "name": "Oklahoma"},
    {"code": "OR", "name": "Oregon"},
    {"code": "PA", "name": "Pennsylvania"},
    {"code": "RI", "name": "Rhode Island"},
    {"code": "SC", "name": "South Carolina"},
    {"code": "SD", "name": "South Dakota"},
    {"code": "TN", "name": "Tennessee"},
    {"code": "TX", "name": "Texas"},
    {"code": "UT", "name": "Utah"},
    {"code": "VT", "name": "Vermont"},
    {"code": "VA", "name": "Virginia"},
    {"code": "WA", "name": "Washington"},
    {"code": "WV", "name": "West Virginia"},
    {"code": "WI", "name": "Wisconsin"},
    {"code": "WY", "name": "Wyoming"},
]

STATE_CODES = {state["code"] for state in STATE_OPTIONS}
STATE_CODE_BY_NAME = {state["name"].lower(): state["code"] for state in STATE_OPTIONS}

FALLBACK_CITIES = {
    "AL": ["Birmingham", "Huntsville", "Mobile", "Montgomery", "Tuscaloosa"],
    "AK": ["Anchorage", "Fairbanks", "Juneau", "Ketchikan", "Wasilla"],
    "AZ": ["Chandler", "Flagstaff", "Mesa", "Phoenix", "Tucson"],
    "AR": ["Fayetteville", "Fort Smith", "Jonesboro", "Little Rock", "Springdale"],
    "CA": ["Fresno", "Los Angeles", "Sacramento", "San Diego", "San Francisco"],
    "CO": ["Aurora", "Boulder", "Colorado Springs", "Denver", "Fort Collins"],
    "CT": ["Bridgeport", "Hartford", "New Haven", "Stamford", "Waterbury"],
    "DE": ["Dover", "Middletown", "Newark", "Smyrna", "Wilmington"],
    "FL": ["Jacksonville", "Miami", "Orlando", "Tampa", "Tallahassee"],
    "GA": ["Athens", "Atlanta", "Augusta", "Macon", "Savannah"],
    "HI": ["Hilo", "Honolulu", "Kailua", "Kaneohe", "Pearl City"],
    "ID": ["Boise", "Idaho Falls", "Meridian", "Nampa", "Pocatello"],
    "IL": ["Aurora", "Chicago", "Naperville", "Peoria", "Rockford"],
    "IN": ["Evansville", "Fort Wayne", "Indianapolis", "South Bend", "Terre Haute"],
    "IA": ["Ames", "Cedar Rapids", "Council Bluffs", "Des Moines", "Iowa City"],
    "KS": ["Kansas City", "Lawrence", "Manhattan", "Overland Park", "Wichita"],
    "KY": ["Bowling Green", "Covington", "Frankfort", "Lexington", "Louisville"],
    "LA": ["Baton Rouge", "Lafayette", "Lake Charles", "New Orleans", "Shreveport"],
    "ME": ["Augusta", "Bangor", "Lewiston", "Portland", "South Portland"],
    "MD": ["Annapolis", "Baltimore", "Frederick", "Gaithersburg", "Rockville"],
    "MA": ["Boston", "Cambridge", "Lowell", "Springfield", "Worcester"],
    "MI": ["Ann Arbor", "Detroit", "Grand Rapids", "Lansing", "Warren"],
    "MN": ["Duluth", "Minneapolis", "Rochester", "Saint Paul", "St. Cloud"],
    "MS": ["Biloxi", "Gulfport", "Hattiesburg", "Jackson", "Southaven"],
    "MO": ["Columbia", "Independence", "Kansas City", "Springfield", "St. Louis"],
    "MT": ["Billings", "Bozeman", "Butte", "Great Falls", "Missoula"],
    "NE": ["Bellevue", "Grand Island", "Kearney", "Lincoln", "Omaha"],
    "NV": ["Carson City", "Henderson", "Las Vegas", "North Las Vegas", "Reno"],
    "NH": ["Concord", "Derry", "Dover", "Manchester", "Nashua"],
    "NJ": ["Atlantic City", "Jersey City", "Newark", "Paterson", "Trenton"],
    "NM": ["Albuquerque", "Farmington", "Las Cruces", "Rio Rancho", "Santa Fe"],
    "NY": ["Albany", "Buffalo", "New York", "Rochester", "Syracuse"],
    "NC": ["Asheville", "Charlotte", "Durham", "Greensboro", "Raleigh"],
    "ND": ["Bismarck", "Dickinson", "Fargo", "Grand Forks", "Minot"],
    "OH": ["Akron", "Cincinnati", "Cleveland", "Columbus", "Toledo"],
    "OK": ["Edmond", "Lawton", "Norman", "Oklahoma City", "Tulsa"],
    "OR": ["Bend", "Eugene", "Gresham", "Portland", "Salem"],
    "PA": ["Allentown", "Erie", "Harrisburg", "Philadelphia", "Pittsburgh"],
    "RI": ["Cranston", "Newport", "Pawtucket", "Providence", "Warwick"],
    "SC": ["Charleston", "Columbia", "Greenville", "Myrtle Beach", "Spartanburg"],
    "SD": ["Aberdeen", "Brookings", "Mitchell", "Rapid City", "Sioux Falls"],
    "TN": ["Chattanooga", "Clarksville", "Knoxville", "Memphis", "Nashville"],
    "TX": ["Austin", "Dallas", "El Paso", "Houston", "San Antonio"],
    "UT": ["Logan", "Ogden", "Provo", "Salt Lake City", "St. George"],
    "VT": ["Barre", "Bennington", "Burlington", "Montpelier", "Rutland"],
    "VA": ["Alexandria", "Arlington", "Norfolk", "Richmond", "Virginia Beach"],
    "WA": ["Bellevue", "Olympia", "Seattle", "Spokane", "Tacoma"],
    "WV": ["Charleston", "Huntington", "Martinsburg", "Morgantown", "Wheeling"],
    "WI": ["Eau Claire", "Green Bay", "Kenosha", "Madison", "Milwaukee"],
    "WY": ["Casper", "Cheyenne", "Gillette", "Laramie", "Rock Springs"],
}

_city_index: dict[str, list[str]] | None = None
_city_index_source = "fallback"
_city_index_lock = Lock()


def get_state_options() -> list[dict[str, str]]:
    return STATE_OPTIONS


def normalize_state_code(state: str) -> str:
    normalized = state.strip()
    if not normalized:
        raise ValueError("State is required.")

    upper = normalized.upper()
    if upper in STATE_CODES:
        return upper

    state_code = STATE_CODE_BY_NAME.get(normalized.lower())
    if state_code:
        return state_code

    raise ValueError(f"Unsupported state: {state}")


def get_cities_for_state(state: str) -> tuple[str, list[str], str]:
    state_code = normalize_state_code(state)
    city_index = _load_city_index()
    return state_code, city_index.get(state_code, FALLBACK_CITIES.get(state_code, [])), _city_index_source


def resolve_inspection_location(
    city: str | None,
    state: str | None,
) -> tuple[str, str] | None:
    clean_city = (city or "").strip()
    clean_state = (state or "").strip()
    city_index = _load_city_index()

    if clean_state:
        try:
            state_code = normalize_state_code(clean_state)
        except ValueError:
            return None
        if not clean_city:
            return None

        cities = city_index.get(state_code, [])
        exact = next((name for name in cities if name.lower() == clean_city.lower()), None)
        if exact:
            return exact, state_code

        partial = [name for name in cities if clean_city.lower() in name.lower()]
        if len(partial) == 1:
            return partial[0], state_code

        if len(clean_city) >= 2 and re.fullmatch(r"[A-Za-z][A-Za-z .'\-]{1,}", clean_city):
            return clean_city.title(), state_code
        return None

    if not clean_city:
        return None

    matches: list[tuple[str, str]] = []
    for state_code, cities in city_index.items():
        for name in cities:
            if name.lower() == clean_city.lower():
                matches.append((name, state_code))

    if len(matches) == 1:
        return matches[0]
    return None


def _load_city_index() -> dict[str, list[str]]:
    global _city_index, _city_index_source

    if _city_index is not None:
        return _city_index

    with _city_index_lock:
        if _city_index is not None:
            return _city_index

        try:
            _city_index = _fetch_city_index()
            _city_index_source = "us_cities_database"
        except Exception:
            _city_index = FALLBACK_CITIES
            _city_index_source = "fallback"

        return _city_index


def _fetch_city_index() -> dict[str, list[str]]:
    response = httpx.get(CITY_DATA_URL, timeout=20.0, follow_redirects=True)
    response.raise_for_status()

    state_city_sets = {state["code"]: set() for state in STATE_OPTIONS}
    reader = csv.DictReader(io.StringIO(response.text))
    for row in reader:
        state_code = (row.get("STATE_CODE") or "").strip().upper()
        city = (row.get("CITY") or "").strip()
        if state_code in state_city_sets and city:
            state_city_sets[state_code].add(city)

    return {
        state_code: sorted(cities, key=lambda name: name.lower())
        for state_code, cities in state_city_sets.items()
    }
