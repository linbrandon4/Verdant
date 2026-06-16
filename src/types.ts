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

export interface LocalBusinessLink {
  name: string;
  url: string;
  source: string;
}

export interface InspectionResult {
  /** Backend: annotated image URL with detection boxes drawn */
  annotatedImageUrl?: string | null;
  /** Backend: total detection count */
  detections?: number | null;
  /** Backend: severity score */
  severity?: number | null;
  /** Backend: repair cost range */
  costToFix?: string | null;
  /** Backend: recommended fix timeline */
  timelineToFix?: string | null;
  /** Backend: sustainable repair method description */
  sustainableFix?: string | null;
  /** Backend: traditional vs sustainable comparison */
  traditionalComparison?: string | null;
  /** Backend: environmental / waste impact summary */
  estimatedImpact?: string | null;
  /** Backend: nearby contractor links */
  localBusinesses?: LocalBusinessLink[];
  /** Backend: bounding boxes if rendered client-side instead of on image */
  detectionBoxes?: DetectionBox[];
}

export function createEmptyInspectionResult(): InspectionResult {
  return {
    annotatedImageUrl: null,
    detections: null,
    severity: null,
    costToFix: null,
    timelineToFix: null,
    sustainableFix: null,
    traditionalComparison: null,
    estimatedImpact: null,
    localBusinesses: [],
    detectionBoxes: [],
  };
}
