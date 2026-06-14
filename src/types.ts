export type AssetType =
  | "bridge"
  | "parking_deck"
  | "road"
  | "building"
  | "retaining_wall"
  | "other_concrete";

export type DamageType =
  | "crack"
  | "water"
  | "water_leakage"
  | "corrosion"
  | "spalling"
  | "missing_concrete"
  | "surface_wear";

export type SeverityLevel = "low" | "medium" | "high" | "critical";

export type Urgency =
  | "monitor"
  | "within_180_days"
  | "within_90_days"
  | "within_30_days"
  | "within_14_days"
  | "immediate";

export type ScanStatus = "idle" | "uploaded" | "analyzing" | "completed" | "failed";

export interface Range {
  min: number;
  max: number;
}

export interface CostRange extends Range {
  currency: "USD";
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourceFile {
  id: string;
  scanId: string;
  fileName: string;
  fileType: string;
  previewUrl: string;
  uploadedAt: string;
  isDemo?: boolean;
}

export interface LocalProvider {
  id: string;
  name: string;
  category: string;
  distanceLabel: string;
  sustainabilityTags: string[];
  estimatedFit: string;
  isMock: true;
}

export interface Finding {
  id: string;
  scanId: string;
  sourceFileId: string;
  damageType: DamageType;
  label: string;
  description: string;
  confidence: number;
  severityLevel: SeverityLevel;
  severityScore: number;
  priorityScore: number;
  bbox: BoundingBox;
  position3d: { x: number; y: number; z: number };
  areaSqFtRange: Range;
  repairCostRange: CostRange;
  timeframeLabel: string;
  urgency: Urgency;
  likelyCause: string;
  recommendedAction: string;
  sustainableSolution: string;
  providerCategory: string;
  localProviders: LocalProvider[];
  avoidedWasteKgRange: Range;
  avoidedCO2eKgRange: Range;
  assumptions: string[];
}

export interface ScanSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  urgentIssues: number;
  topPriorityFindingId: string | null;
  recommendedNextStep: string;
  recommendedTimeframe: string;
  totalEstimatedCostRange: CostRange;
  totalAvoidedWasteKgRange: Range;
  totalAvoidedCO2eKgRange: Range;
  healthScore: number;
  sustainabilityScore: number;
  sustainabilityImpact: "low" | "medium" | "high";
  executiveSummary: string;
}

export interface Scan {
  id: string;
  name: string;
  assetType: AssetType;
  locationLabel: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  status: ScanStatus;
  sourceFileCount: number;
  sourceFiles: SourceFile[];
  findings: Finding[];
  summary: ScanSummary;
  reportMarkdown: string;
}

export interface ProgressStage {
  id: string;
  label: string;
  state: "pending" | "running" | "complete";
}

export const severityRank: Record<SeverityLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// Compatibility types for the original 3D prototype helpers.
export type IssueSeverity = "low" | "moderate" | "high" | "critical";

export type ProcessingStage =
  | "ingest"
  | "frames"
  | "reconstruct"
  | "detect"
  | "localize"
  | "report";

export interface Vector3Point {
  x: number;
  y: number;
  z: number;
}

export interface DamageIssue {
  id: string;
  type: "crack" | "corrosion" | "spalling" | "water";
  severity: IssueSeverity;
  confidence: number;
  title: string;
  component: string;
  summary: string;
  recommendation: string;
  frameReference: string;
  normalizedImagePoint: { x: number; y: number };
  position: Vector3Point;
  areaSqFt: number;
  priority: number;
}

export interface InspectionResult {
  id: string;
  createdAt: string;
  assetName: string;
  inputName: string;
  inputKind: "sample" | "image" | "video" | "unknown";
  healthScore: number;
  riskLevel: IssueSeverity;
  status: "complete";
  issues: DamageIssue[];
  summary: string;
  recommendation: string;
  carbonNote: string;
  model: {
    type: "digital-twin-preview";
    description: string;
    sourceFrames: number;
    reconstructionConfidence: number;
  };
}

export interface StageProgress {
  stage: ProcessingStage;
  label: string;
  detail: string;
  state: "pending" | "running" | "complete";
}
