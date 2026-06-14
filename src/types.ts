export type DamageType = "crack" | "corrosion" | "spalling" | "water";

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
  type: DamageType;
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
