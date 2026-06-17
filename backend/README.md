# InfraVision AI Backend

FastAPI backend for uploading one road or building image, running local YOLOv8 damage detection, computing severity, and generating a Gemini sustainability report from structured detection JSON.

## 1. Create a virtual environment

From this folder:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2. Install dependencies

```powershell
pip install -r requirements.txt
```

## 3. Place YOLO weights

Put the local model weight files here:

```text
backend/weights/building_damage.pt
backend/weights/road_damage.pt
```

The included public models use these classes:

```text
building_damage.pt
0 crack

road_damage.pt
0 crack
1 pothole
```

The backend also supports richer custom building weights with labels like `leakage`, `corrosion`, `abscission`, and `bulge` if you replace `building_damage.pt` later. It normalizes common aliases such as `rust` to `corrosion`, `spalling` to `abscission`, and crack variants to `crack`.

You can override these paths in `.env` with `BUILDING_MODEL_PATH` and `ROAD_MODEL_PATH`.

## 4. Create `.env`

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Then fill in values as needed:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
BUILDING_MODEL_PATH=weights/building_damage.pt
ROAD_MODEL_PATH=weights/road_damage.pt
GOOGLE_PLACES_API_KEY=
YOLO_CONFIDENCE_THRESHOLD=0.50
```

Do not commit real API keys.

Detections below 50% confidence are ignored even if the environment value is set lower.
Estimated repair cost is based on inspection type, severity, and detected bounding-box area in pixels. This is an area proxy, not a field measurement, so contractors should verify it on site.
Local businesses are generated from the City and State fields. They come from Google Places when `GOOGLE_PLACES_API_KEY` is set. Without that key, the backend tries web search results for actual business names and websites, then OpenStreetMap/Nominatim, then last-resort map search links if no businesses are found.
Sustainability comparisons include low-to-high ranges for estimated material waste avoided, estimated kg CO2e avoided, and a mature-tree-year CO2 absorption analogy. These are planning estimates from detections and should be verified with field measurements.

## 5. Run the backend

```powershell
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

Open the minimal upload frontend at:

```text
http://127.0.0.1:8000/
```

## 6. Example curl request

```bash
curl -X POST "http://127.0.0.1:8000/api/inspect" \
  -F "file=@sample-image.jpg" \
  -F "city=Atlanta" \
  -F "state=GA"
```

The backend defaults to auto-detection. It runs available road and building models, then picks the type with more confident detections. If both models find no confident damage, it defaults to `road` because there is no detection evidence to distinguish the scene.

## 7. Example JSON response

```json
{
  "inspection_type": "road",
  "image_filename": "sample-road_7a4b.jpg",
  "detections": [
    {
      "damage_type": "pothole",
      "confidence": 0.91,
      "bbox": [10.0, 20.0, 180.0, 140.0],
      "estimated_area_pixels": 20400,
      "severity_hint": "high"
    }
  ],
  "aggregates": {
    "total_detections": 1,
    "damage_counts": {
      "pothole": 1
    },
    "average_confidence": 0.91
  },
  "computed_assessment": {
    "severity_score": 2.5,
    "priority": "Low",
    "recommended_timeframe": "Reinspect within 90 days"
  },
  "gemini_report": {
    "estimated_cost_range": "$500 - $1,500",
    "cost_reasoning": "Estimated from inspection type, deterministic severity priority, and detection count.",
    "traditional_solution": "Standard asphalt patching, crack sealing, lane control, and debris removal as applicable.",
    "sustainable_solution": "Prioritize targeted repair, recycled asphalt mix where available, and staged maintenance to reduce material use.",
    "sustainability_comparison": "The sustainable option favors targeted intervention and lower-waste materials.",
    "estimated_avoided_material_waste": "Estimated reduction depends on actual repair area.",
    "estimated_carbon_savings": "Estimated savings may come from reduced virgin material use and fewer haul trips.",
    "impact_analogy": "A targeted repair approach can be similar to replacing only a damaged panel instead of rebuilding an entire section.",
    "recommended_timeframe": "Reinspect within 90 days",
    "local_business_search_terms": [
      "asphalt repair near Atlanta GA"
    ],
    "summary": "Detected 1 item(s) for a road inspection: pothole. Priority is Low with severity score 2.5.",
    "disclaimer": "Fallback report generated locally if Gemini is unavailable."
  },
  "annotated_image_path": "C:/path/to/backend/uploads/annotated/sample-road_road_ab12cd34.jpg",
  "annotated_image_url": "/uploads/annotated/sample-road_road_ab12cd34.jpg"
}
```

## Health check

```bash
curl "http://127.0.0.1:8000/api/health"
```

Response:

```json
{
  "status": "ok",
  "building_model_loaded": false,
  "road_model_loaded": false
}
```

If model files are missing, the server still starts. `/api/inspect` returns a `503` response explaining which weight file is missing.
