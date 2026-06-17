/** Mirrors backend `app/models/schemas.py` for the inspect endpoint. */

export type BackendInspectionType = "auto" | "road" | "building";

export interface BackendDamageDetection {
  damage_type: string;
  confidence: number;
  bbox: [number, number, number, number];
  estimated_area_pixels: number;
  severity_hint: "low" | "medium" | "high";
}

export interface BackendAggregates {
  total_detections: number;
  damage_counts: Record<string, number>;
  average_confidence: number;
}

export interface BackendComputedAssessment {
  severity_score: number;
  priority: "Low" | "Medium" | "High" | "Critical";
  recommended_timeframe: string;
}

export interface BackendGeminiReport {
  estimated_cost_range: string;
  cost_reasoning: string;
  traditional_solution: string;
  sustainable_solution: string;
  sustainability_comparison: string;
  estimated_avoided_material_waste: "Low" | "Medium" | "High";
  estimated_carbon_savings: "Low" | "Medium" | "High";
  impact_analogy: string;
  recommended_timeframe: string;
  local_business_search_terms: string[];
  summary: string;
  disclaimer: string;
}

export interface BackendLocalBusiness {
  name: string;
  search_term: string;
  source: "google_places" | "web_search" | "openstreetmap" | "search_term" | "gemini_search";
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  maps_url?: string | null;
  rating?: number | null;
  user_rating_count?: number | null;
  note?: string | null;
}

export interface BackendInspectionResponse {
  analysis_engine: "gemini_vision" | "yolo";
  analysis_notes?: string | null;
  inspection_type: "road" | "building";
  image_filename: string;
  detections: BackendDamageDetection[];
  aggregates: BackendAggregates;
  computed_assessment: BackendComputedAssessment;
  gemini_report: BackendGeminiReport;
  local_businesses: BackendLocalBusiness[];
  annotated_image_path?: string | null;
  annotated_image_url?: string | null;
}

export interface InspectImageParams {
  file: File;
  inspectionType?: BackendInspectionType;
  city?: string;
  state?: string;
}
