import { createSampleInspection, severityRank } from "../data/sampleInspection";
import type {
  DamageIssue,
  DamageType,
  InspectionResult,
  IssueSeverity,
  StageProgress,
} from "../types";

interface FrameSample {
  index: number;
  width: number;
  height: number;
  data: ImageData;
}

interface SignalBucket {
  count: number;
  x: number;
  y: number;
  frame: number;
}

const STAGES: StageProgress[] = [
  {
    stage: "ingest",
    label: "Ingest media",
    detail: "Reading video or image metadata",
    state: "pending",
  },
  {
    stage: "frames",
    label: "Extract frames",
    detail: "Sampling inspection views for visual analysis",
    state: "pending",
  },
  {
    stage: "reconstruct",
    label: "Build 3D context",
    detail: "Estimating bridge span, supports, and component locations",
    state: "pending",
  },
  {
    stage: "detect",
    label: "Detect defects",
    detail: "Scanning for crack, corrosion, spalling, and water signatures",
    state: "pending",
  },
  {
    stage: "localize",
    label: "Place markers",
    detail: "Projecting detections into bridge coordinates",
    state: "pending",
  },
  {
    stage: "report",
    label: "Generate report",
    detail: "Scoring health and prioritizing repair actions",
    state: "pending",
  },
];

const issueCopy: Record<
  DamageType,
  {
    title: string;
    component: string;
    summary: string;
    recommendation: string;
  }
> = {
  crack: {
    title: "Possible linear cracking",
    component: "Deck or girder surface",
    summary:
      "Dark, narrow linear features were detected across multiple sampled pixels.",
    recommendation:
      "Perform close visual confirmation, measure width, and seal if the crack is active or water-bearing.",
  },
  corrosion: {
    title: "Possible corrosion staining",
    component: "Steel detail or bearing area",
    summary:
      "Orange-brown color clusters are consistent with rust staining or exposed steel oxidation.",
    recommendation:
      "Clean affected steel, verify section loss, and correct moisture source before recoating.",
  },
  spalling: {
    title: "Possible concrete spalling",
    component: "Concrete face",
    summary:
      "Irregular gray surface signatures suggest roughened or missing concrete cover.",
    recommendation:
      "Sound the surrounding concrete, remove loose material, and patch after checking reinforcement condition.",
  },
  water: {
    title: "Possible water staining",
    component: "Joint or drainage path",
    summary:
      "Blue-green or dark vertical staining suggests recurring moisture or drainage failure.",
    recommendation:
      "Inspect deck drains, expansion joints, and weep paths. Re-scan after rainfall or washdown.",
  },
};

export function initialStages(): StageProgress[] {
  return STAGES.map((stage) => ({ ...stage }));
}

export async function runInspection(
  file: File | null,
  onStage: (stages: StageProgress[]) => void,
): Promise<InspectionResult> {
  const stages = initialStages();

  const advance = async (stageIndex: number, detail?: string) => {
    stages.forEach((stage, index) => {
      if (index < stageIndex) stage.state = "complete";
      if (index === stageIndex) stage.state = "running";
      if (index > stageIndex) stage.state = "pending";
    });
    if (detail) stages[stageIndex].detail = detail;
    onStage(stages.map((stage) => ({ ...stage })));
    await delay(450);
  };

  await advance(0, file ? `Loaded ${file.name}` : "Using built-in demo scan");

  if (!file) {
    await advance(1);
    await advance(2);
    await advance(3);
    await advance(4);
    await advance(5);
    stages.forEach((stage) => (stage.state = "complete"));
    onStage(stages.map((stage) => ({ ...stage })));
    return createSampleInspection();
  }

  let frames: FrameSample[] = [];
  try {
    await advance(1, "Extracting representative frames");
    frames = await extractFrames(file);
  } catch {
    frames = [];
  }

  await advance(2, `${Math.max(frames.length, 1)} view sample${frames.length === 1 ? "" : "s"} mapped`);
  await advance(3, "Running prototype visual signatures");
  const issues = frames.length > 0 ? detectIssues(frames) : [];

  await advance(4, `${issues.length} issue marker${issues.length === 1 ? "" : "s"} positioned`);
  await advance(5, "Computing preview score and maintenance action");

  stages.forEach((stage) => (stage.state = "complete"));
  onStage(stages.map((stage) => ({ ...stage })));

  return buildResult(file, frames.length, issues);
}

function buildResult(
  file: File,
  sourceFrames: number,
  issues: DamageIssue[],
): InspectionResult {
  const healthScore = computeHealthScore(issues);
  const riskLevel = computeRiskLevel(healthScore, issues);
  const highCount = issues.filter(
    (issue) => issue.severity === "high" || issue.severity === "critical",
  ).length;

  return {
    id: makeId("inspection"),
    createdAt: new Date().toISOString(),
    assetName: "Uploaded Structure Scan",
    inputName: file.name,
    inputKind: file.type.startsWith("video")
      ? "video"
      : file.type.startsWith("image")
        ? "image"
        : "unknown",
    healthScore,
    riskLevel,
    status: "complete",
    issues,
    summary:
      issues.length === 0
        ? "No priority defects were flagged by the prototype vision pass. Use this as a preview only until a trained inspection model is connected."
        : `Prototype vision flagged ${issues.length} possible issue${issues.length === 1 ? "" : "s"}, including ${highCount} high-priority finding${highCount === 1 ? "" : "s"}.`,
    recommendation: buildRecommendation(riskLevel, issues.length),
    carbonNote:
      "The recommended workflow is targeted preservation first: verify defects, repair locally, and re-scan over time before considering major replacement.",
    model: {
      type: "digital-twin-preview",
      description:
        "Browser-generated inspection twin with defect locations projected from media coordinates. Production deployments should replace this geometry with the generated Gaussian Splat.",
      sourceFrames: Math.max(sourceFrames, 1),
      reconstructionConfidence: clamp(0.62 + Math.min(sourceFrames, 5) * 0.05, 0.62, 0.9),
    },
  };
}

async function extractFrames(file: File): Promise<FrameSample[]> {
  if (file.type.startsWith("image")) {
    return [await imageToFrame(file, 0)];
  }

  if (file.type.startsWith("video")) {
    return videoToFrames(file);
  }

  throw new Error("Unsupported media type");
}

async function imageToFrame(file: File, index: number): Promise<FrameSample> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return drawToFrame(image, index);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function videoToFrames(file: File): Promise<FrameSample[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";
  video.src = url;

  try {
    await waitFor(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const times = [0.18, 0.42, 0.68, 0.86].map((pct) =>
      Math.min(duration - 0.05, Math.max(0, duration * pct)),
    );
    const frames: FrameSample[] = [];

    for (let index = 0; index < times.length; index += 1) {
      video.currentTime = times[index];
      await waitFor(video, "seeked");
      frames.push(drawToFrame(video, index));
    }

    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToFrame(source: CanvasImageSource, index: number): FrameSample {
  const width =
    "videoWidth" in source && typeof source.videoWidth === "number"
      ? source.videoWidth
      : "naturalWidth" in source && typeof source.naturalWidth === "number"
        ? source.naturalWidth
        : 1280;
  const height =
    "videoHeight" in source && typeof source.videoHeight === "number"
      ? source.videoHeight
      : "naturalHeight" in source && typeof source.naturalHeight === "number"
        ? source.naturalHeight
        : 720;
  const scale = Math.min(1, 760 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is unavailable");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return {
    index,
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height),
  };
}

function detectIssues(frames: FrameSample[]): DamageIssue[] {
  const buckets: Record<DamageType, SignalBucket> = {
    crack: { count: 0, x: 0, y: 0, frame: 0 },
    corrosion: { count: 0, x: 0, y: 0, frame: 0 },
    spalling: { count: 0, x: 0, y: 0, frame: 0 },
    water: { count: 0, x: 0, y: 0, frame: 0 },
  };
  let samples = 0;

  for (const frame of frames) {
    const { width, height, data } = frame.data;
    const step = Math.max(4, Math.round(Math.max(width, height) / 220));

    for (let y = step; y < height - step; y += step) {
      for (let x = step; x < width - step; x += step) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const brightness = (r + g + b) / 3;
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        const neighbor = ((y + step) * width + x + step) * 4;
        const edge =
          Math.abs(r - data[neighbor]) +
          Math.abs(g - data[neighbor + 1]) +
          Math.abs(b - data[neighbor + 2]);
        const localContrast =
          Math.abs(brightness - (data[neighbor] + data[neighbor + 1] + data[neighbor + 2]) / 3);

        samples += 1;
        if (brightness < 58 && spread < 42 && edge > 92 && localContrast > 34) {
          addSignal(buckets.crack, x / width, y / height, frame.index);
        }
        if (r > 122 && r > g * 1.2 && g > b * 1.18 && b < 132 && edge > 22) {
          addSignal(buckets.corrosion, x / width, y / height, frame.index);
        }
        if (spread < 24 && brightness > 92 && brightness < 188 && edge > 112 && localContrast > 36) {
          addSignal(buckets.spalling, x / width, y / height, frame.index);
        }
        if (
          (b > r + 24 && g > r + 12 && brightness < 150 && edge > 28) ||
          (g > r + 24 && brightness < 110 && spread > 28 && edge > 34)
        ) {
          addSignal(buckets.water, x / width, y / height, frame.index);
        }
      }
    }
  }

  return (Object.keys(buckets) as DamageType[])
    .map((type) => buildIssue(type, buckets[type], samples))
    .filter((issue): issue is DamageIssue => issue !== null)
    .sort((a, b) => b.priority - a.priority);
}

function buildIssue(
  type: DamageType,
  bucket: SignalBucket,
  sampleCount: number,
): DamageIssue | null {
  if (bucket.count === 0 || sampleCount === 0) return null;
  const ratio = bucket.count / sampleCount;
  const threshold: Record<DamageType, number> = {
    crack: 0.0025,
    corrosion: 0.0035,
    spalling: 0.003,
    water: 0.004,
  };
  if (ratio < threshold[type]) return null;

  const confidence = clamp(0.48 + ratio * 12, 0.5, 0.88);
  const severity = severityFromSignal(ratio, confidence);
  const cx = clamp(bucket.x / bucket.count, 0.08, 0.92);
  const cy = clamp(bucket.y / bucket.count, 0.08, 0.92);
  const copy = issueCopy[type];
  const position = mapToBridge(type, cx, cy);

  return {
    id: makeId(type),
    type,
    severity,
    confidence,
    title: copy.title,
    component: componentFromPoint(type, cx, cy),
    summary: copy.summary,
    recommendation: copy.recommendation,
    frameReference: `Frame ${String(bucket.frame + 1).padStart(3, "0")}`,
    normalizedImagePoint: { x: cx, y: cy },
    position,
    areaSqFt: Number(clamp(ratio * 120, 0.4, 6.8).toFixed(1)),
    priority: Math.round(severityRank[severity] * 18 + confidence * 16),
  };
}

function addSignal(bucket: SignalBucket, x: number, y: number, frame: number) {
  bucket.count += 1;
  bucket.x += x;
  bucket.y += y;
  bucket.frame = frame;
}

function severityFromSignal(ratio: number, confidence: number): IssueSeverity {
  const signal = ratio * confidence;
  if (signal > 0.055) return "critical";
  if (signal > 0.03) return "high";
  if (signal > 0.012) return "moderate";
  return "low";
}

function mapToBridge(type: DamageType, x: number, y: number) {
  const worldX = Number(((x - 0.5) * 9.2).toFixed(2));
  const worldZ = Number(((y - 0.5) * 3.4).toFixed(2));
  const baseY: Record<DamageType, number> = {
    crack: 0.22,
    corrosion: -0.12,
    spalling: -1.15,
    water: 0.28,
  };
  return {
    x: worldX,
    y: baseY[type],
    z: worldZ,
  };
}

function componentFromPoint(type: DamageType, x: number, y: number): string {
  if (type === "corrosion") return x > 0.5 ? "Right bearing seat" : "Left bearing seat";
  if (type === "spalling") return x > 0.5 ? "Pier 2" : "Pier 1";
  if (type === "water") return y < 0.45 ? "Expansion joint" : "Drainage path";
  return y < 0.5 ? "Deck top surface" : "Deck underside";
}

function computeHealthScore(issues: DamageIssue[]): number {
  const penalty = issues.reduce((total, issue) => {
    const severityPenalty: Record<IssueSeverity, number> = {
      low: 3,
      moderate: 7,
      high: 14,
      critical: 24,
    };
    return total + severityPenalty[issue.severity] * issue.confidence + Math.min(issue.areaSqFt, 5) * 0.5;
  }, 0);
  const floor = issues.some((issue) => issue.severity === "critical")
    ? 42
    : issues.some((issue) => issue.severity === "high")
      ? 58
      : 68;
  return Math.round(clamp(94 - penalty, floor, 98));
}

function computeRiskLevel(score: number, issues: DamageIssue[]): IssueSeverity {
  if (issues.some((issue) => issue.severity === "critical") || score < 45) return "critical";
  if (issues.some((issue) => issue.severity === "high") || score < 70) return "high";
  if (issues.length > 0 || score < 86) return "moderate";
  return "low";
}

function buildRecommendation(risk: IssueSeverity, count: number): string {
  if (risk === "critical") {
    return "Restrict loads or access as appropriate and dispatch a qualified inspector immediately.";
  }
  if (risk === "high") {
    return "Schedule hands-on inspection within 14 days and complete targeted repairs before seasonal weather exposure.";
  }
  if (risk === "moderate") {
    return "Create a maintenance work order, verify defects in the field, and re-scan after repair or the next major storm.";
  }
  return count === 0
    ? "Continue routine monitoring and repeat the scan on the next inspection cycle."
    : "Track the marked issues and repeat the scan after low-cost preventive maintenance.";
}

function waitFor(element: HTMLElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, 10000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      element.removeEventListener(event, handle);
      element.removeEventListener("error", fail);
    };
    const handle = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error(`Media failed while waiting for ${event}`));
    };
    element.addEventListener(event, handle, { once: true });
    element.addEventListener("error", fail, { once: true });
  });
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeId(prefix: string) {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}
