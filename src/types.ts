export type AssetType =
  | "bridge"
  | "parking_deck"
  | "road"
  | "building"
  | "retaining_wall"
  | "other_concrete";

export interface SourceFile {
  id: string;
  fileName: string;
  fileType: string;
  previewUrl: string;
  uploadedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  organization?: string;
}

export interface InspectionDraft {
  id: string;
  name: string;
  assetType: AssetType;
  locationLabel: string;
  notes: string;
  sourceFiles: SourceFile[];
  createdAt: string;
}

export interface DetectionBox {
  id: string;
  label: string;
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface DetectionDetail {
  damageType: string;
  confidence: number;
  severityHint: string;
}

export interface LocalBusinessLink {
  name: string;
  url: string;
  source: string;
  specialty?: string | null;
  address?: string | null;
  phone?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
}

export interface ImageInspectionResult {
  fileName: string;
  annotatedImageUrl?: string | null;
  detections?: number | null;
  severity?: number | null;
  priority?: string | null;
  inspectionType?: string | null;
  detectionDetails?: DetectionDetail[];
  detectionBoxes?: DetectionBox[];
}

export interface InspectionResult {
  annotatedImageUrl?: string | null;
  detections?: number | null;
  severity?: number | null;
  priority?: string | null;
  inspectionType?: string | null;
  averageConfidence?: number | null;
  damageCounts?: Record<string, number>;
  detectionDetails?: DetectionDetail[];
  costToFix?: string | null;
  costReasoning?: string | null;
  sustainableCost?: string | null;
  traditionalCost?: string | null;
  timelineToFix?: string | null;
  sustainableFix?: string | null;
  traditionalSolution?: string | null;
  sustainabilityComparison?: string | null;
  estimatedImpact?: string | null;
  summary?: string | null;
  disclaimer?: string | null;
  analysisEngine?: string | null;
  analysisNotes?: string | null;
  localBusinesses?: LocalBusinessLink[];
  detectionBoxes?: DetectionBox[];
  images?: ImageInspectionResult[];
}

export interface SavedAnalysis {
  id: string;
  name: string;
  assetType: AssetType;
  locationLabel: string;
  notes: string;
  result: InspectionResult;
  createdAt: string;
}

export function createEmptyInspectionResult(): InspectionResult {
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
