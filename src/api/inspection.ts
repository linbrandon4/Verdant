import type { AssetType, DetectionDetail, ImageInspectionResult, InspectionResult } from "../types";
import type { BackendDamageDetection, BackendInspectionResponse, InspectImageParams } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const PRIORITY_RANK: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:")) {
    return path;
  }
  return apiUrl(path.startsWith("/") ? path : `/${path}`);
}

function mapDetectionDetails(detections: BackendDamageDetection[]): DetectionDetail[] {
  return detections.map((detection) => ({
    damageType: detection.damage_type,
    confidence: Math.round(detection.confidence * 100),
    severityHint: detection.severity_hint,
  }));
}

function formatInspectionType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function assetTypeToInspectionType(assetType: AssetType): "auto" | "road" | "building" {
  switch (assetType) {
    case "road":
      return "road";
    case "bridge":
    case "building":
    case "parking_deck":
    case "retaining_wall":
    case "other_concrete":
      return "building";
    default:
      return "auto";
  }
}

function splitCostRange(range: string | null | undefined): {
  sustainable: string | null;
  traditional: string | null;
} {
  if (!range?.trim()) {
    return { sustainable: null, traditional: null };
  }

  const rangeMatch = range.match(
    /(\$[\d,]+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\$[\d,]+(?:\.\d+)?)/i,
  );
  if (rangeMatch) {
    return { sustainable: rangeMatch[1], traditional: rangeMatch[2] };
  }

  return { sustainable: range.trim(), traditional: range.trim() };
}

export function mapInspectionResponse(
  response: BackendInspectionResponse,
  fileName?: string,
): InspectionResult {
  const { aggregates, computed_assessment, gemini_report, local_businesses, detections } = response;

  const detectionDetails = mapDetectionDetails(detections);

  const impactParts = [
    gemini_report.estimated_avoided_material_waste
      ? `Material waste avoided: ${gemini_report.estimated_avoided_material_waste}`
      : null,
    gemini_report.estimated_carbon_savings
      ? `Carbon savings: ${gemini_report.estimated_carbon_savings}`
      : null,
    gemini_report.impact_analogy || null,
  ].filter(Boolean);

  const { sustainable: sustainableCost, traditional: traditionalCost } = splitCostRange(
    gemini_report.estimated_cost_range,
  );

  const imageResult: ImageInspectionResult = {
    fileName: fileName ?? response.image_filename,
    annotatedImageUrl: resolveAssetUrl(response.annotated_image_url),
    detections: aggregates.total_detections,
    severity: computed_assessment.severity_score,
    priority: computed_assessment.priority,
    inspectionType: formatInspectionType(response.inspection_type),
    detectionDetails,
    detectionBoxes: [],
  };

  return {
    annotatedImageUrl: imageResult.annotatedImageUrl,
    detections: aggregates.total_detections,
    severity: computed_assessment.severity_score,
    priority: computed_assessment.priority,
    inspectionType: formatInspectionType(response.inspection_type),
    averageConfidence: Math.round(aggregates.average_confidence * 100),
    damageCounts: aggregates.damage_counts,
    detectionDetails,
    costToFix: gemini_report.estimated_cost_range,
    costReasoning: gemini_report.cost_reasoning,
    sustainableCost,
    traditionalCost,
    timelineToFix: gemini_report.recommended_timeframe || computed_assessment.recommended_timeframe,
    sustainableFix: gemini_report.sustainable_solution,
    traditionalSolution: gemini_report.traditional_solution,
    sustainabilityComparison: gemini_report.sustainability_comparison,
    estimatedImpact: impactParts.join("\n\n"),
    summary: gemini_report.summary,
    disclaimer: gemini_report.disclaimer,
    analysisEngine: response.analysis_engine,
    analysisNotes: response.analysis_notes ?? null,
    localBusinesses: local_businesses.map((biz) => ({
      name: biz.name,
      url: biz.website || biz.maps_url || "#",
      source: biz.source.replace(/_/g, " "),
      specialty: biz.note ?? null,
      address: biz.address ?? null,
      phone: biz.phone ?? null,
      rating: biz.rating ?? null,
      ratingCount: biz.user_rating_count ?? null,
    })),
    detectionBoxes: [],
    images: [imageResult],
  };
}

function dedupeBusinesses(links: InspectionResult["localBusinesses"] = []) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.url}|${link.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeDamageCounts(
  results: InspectionResult[],
): Record<string, number> | undefined {
  const merged: Record<string, number> = {};
  for (const result of results) {
    if (!result.damageCounts) continue;
    for (const [type, count] of Object.entries(result.damageCounts)) {
      merged[type] = (merged[type] ?? 0) + count;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function pickHighestPriority(results: InspectionResult[]): string | null {
  let best: string | null = null;
  let bestRank = 0;
  for (const result of results) {
    if (!result.priority) continue;
    const rank = PRIORITY_RANK[result.priority] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = result.priority;
    }
  }
  return best;
}

export function mergeInspectionResults(results: InspectionResult[]): InspectionResult {
  if (results.length === 0) return createEmptyInspectionResult();
  if (results.length === 1) return results[0];

  const images = results.flatMap((result) => result.images ?? []);
  const worst = results.reduce((current, candidate) =>
    (candidate.severity ?? 0) > (current.severity ?? 0) ? candidate : current,
  );

  const totalDetections = results.reduce((sum, result) => sum + (result.detections ?? 0), 0);
  const maxSeverity = Math.max(...results.map((result) => result.severity ?? 0));
  const confidenceValues = results
    .map((result) => result.averageConfidence)
    .filter((value): value is number => value != null && value > 0);
  const averageConfidence =
    confidenceValues.length > 0
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : worst.averageConfidence;

  return {
    ...worst,
    annotatedImageUrl: images.length === 1 ? images[0].annotatedImageUrl : null,
    detections: totalDetections,
    severity: maxSeverity,
    priority: pickHighestPriority(results) ?? worst.priority,
    averageConfidence,
    damageCounts: mergeDamageCounts(results),
    detectionDetails: results.flatMap((result) => result.detectionDetails ?? []),
    localBusinesses: dedupeBusinesses(results.flatMap((result) => result.localBusinesses ?? [])),
    images,
  };
}

function createEmptyInspectionResult(): InspectionResult {
  return {
    annotatedImageUrl: null,
    detections: null,
    severity: null,
    priority: null,
    inspectionType: null,
    averageConfidence: null,
    damageCounts: {},
    detectionDetails: [],
    costToFix: null,
    costReasoning: null,
    sustainableCost: null,
    traditionalCost: null,
    timelineToFix: null,
    sustainableFix: null,
    traditionalSolution: null,
    sustainabilityComparison: null,
    estimatedImpact: null,
    summary: null,
    disclaimer: null,
    analysisEngine: null,
    analysisNotes: null,
    localBusinesses: [],
    detectionBoxes: [],
    images: [],
  };
}

export type InspectProgress = {
  current: number;
  total: number;
  fileName: string;
};

export async function inspectImages(
  params: Omit<InspectImageParams, "file"> & {
    files: File[];
    onProgress?: (progress: InspectProgress) => void;
  },
): Promise<InspectionResult> {
  const mapped: InspectionResult[] = [];

  for (let index = 0; index < params.files.length; index += 1) {
    const file = params.files[index];
    params.onProgress?.({
      current: index + 1,
      total: params.files.length,
      fileName: file.name,
    });

    const response = await inspectImage({
      file,
      inspectionType: params.inspectionType,
      city: params.city,
      state: params.state,
    });
    mapped.push(mapInspectionResponse(response, file.name));
  }

  return mergeInspectionResults(mapped);
}

export class InspectionApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "InspectionApiError";
    this.status = status;
  }
}

export async function inspectImage(params: InspectImageParams): Promise<BackendInspectionResponse> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("inspection_type", params.inspectionType ?? "auto");
  if (params.city) form.append("city", params.city);
  if (params.state) form.append("state", params.state);

  const response = await fetch(apiUrl("/api/inspect"), {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let detail = `Inspection failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail)) {
        detail = body.detail.map((item) => item.msg).filter(Boolean).join("; ") || detail;
      }
    } catch {
      // keep default message
    }
    throw new InspectionApiError(detail, response.status);
  }

  return (await response.json()) as BackendInspectionResponse;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(apiUrl("/api/health"));
    return response.ok;
  } catch {
    return false;
  }
}
