import type {
  AssetType,
  CostRange,
  DamageType,
  Finding,
  LocalProvider,
  ProgressStage,
  Range,
  Scan,
  ScanSummary,
  SeverityLevel,
  SourceFile,
  Urgency,
} from "../types";
import { severityRank } from "../types";

interface ScanInput {
  name: string;
  assetType: AssetType;
  locationLabel: string;
  notes: string;
  sourceFiles: SourceFile[];
}

interface FindingSeed {
  damageType: DamageType;
  label: string;
  description: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  position3d: { x: number; y: number; z: number };
  severityBoost?: number;
}

const progressLabels = [
  "Preparing inspection set",
  "Running damage detection",
  "Estimating repair urgency",
  "Calculating avoided waste and CO2e",
  "Building report",
];

const baseSeverity: Record<DamageType, number> = {
  crack: 45,
  water: 50,
  water_leakage: 50,
  corrosion: 55,
  spalling: 62,
  missing_concrete: 68,
  surface_wear: 32,
};

const typeLabels: Record<DamageType, string> = {
  crack: "Deck crack",
  water: "Water staining",
  water_leakage: "Water leakage",
  corrosion: "Rust / corrosion",
  spalling: "Concrete spalling",
  missing_concrete: "Missing concrete",
  surface_wear: "Surface wear",
};

const recommendations: Record<
  DamageType,
  {
    likelyCause: string;
    recommendedAction: string;
    sustainableSolution: string;
    providerCategory: string;
    cost: CostRange;
  }
> = {
  crack: {
    likelyCause: "Freeze-thaw cycling, shrinkage, structural movement, or water intrusion.",
    recommendedAction: "Seal the crack, document its length and width, and recheck after the next rain event.",
    sustainableSolution:
      "Localized crack sealing keeps water out and can delay larger concrete removal.",
    providerCategory: "Concrete crack sealing contractor",
    cost: { min: 300, max: 2500, currency: "USD" },
  },
  water: {
    likelyCause: "Failed joint seal, blocked drainage path, or waterproofing breakdown.",
    recommendedAction: "Inspect drainage, clear debris, seal the affected joint, and monitor for spread.",
    sustainableSolution:
      "Targeted waterproofing prevents moisture-driven deterioration and avoids premature deck repair.",
    providerCategory: "Waterproofing / drainage repair specialist",
    cost: { min: 500, max: 5000, currency: "USD" },
  },
  water_leakage: {
    likelyCause: "Failed joint seal, blocked drainage path, or waterproofing breakdown.",
    recommendedAction: "Inspect drainage, clear debris, seal the affected joint, and monitor for spread.",
    sustainableSolution:
      "Targeted waterproofing prevents moisture-driven deterioration and avoids premature deck repair.",
    providerCategory: "Waterproofing / drainage repair specialist",
    cost: { min: 500, max: 5000, currency: "USD" },
  },
  corrosion: {
    likelyCause: "Moisture exposure, chloride salts, coating failure, or exposed embedded steel.",
    recommendedAction: "Remove loose corrosion, assess section loss, coat exposed metal, and inspect nearby concrete.",
    sustainableSolution:
      "Localized corrosion treatment extends component life and delays steel replacement.",
    providerCategory: "Structural steel coating / corrosion mitigation contractor",
    cost: { min: 800, max: 8000, currency: "USD" },
  },
  spalling: {
    likelyCause: "Water infiltration, corroding reinforcement, or freeze-thaw expansion.",
    recommendedAction: "Remove unsound concrete, patch with repair mortar, and investigate the moisture source.",
    sustainableSolution:
      "Patch repair with low-carbon mortar where available instead of removing a larger section.",
    providerCategory: "Concrete restoration contractor",
    cost: { min: 1000, max: 12000, currency: "USD" },
  },
  missing_concrete: {
    likelyCause: "Advanced spalling, impact damage, or reinforcement corrosion pushing cover concrete away.",
    recommendedAction: "Request structural review, repair the missing section, and check for exposed reinforcement.",
    sustainableSolution:
      "Targeted concrete restoration avoids larger demolition and replacement if caught early.",
    providerCategory: "Structural concrete repair contractor",
    cost: { min: 2500, max: 18000, currency: "USD" },
  },
  surface_wear: {
    likelyCause: "Traffic abrasion, weathering, deicing chemicals, or deferred surface maintenance.",
    recommendedAction: "Monitor wear and apply protective coating or resurfacing where needed.",
    sustainableSolution:
      "Preventive surface treatment extends service life with less material than full resurfacing.",
    providerCategory: "Preventive maintenance / resurfacing contractor",
    cost: { min: 250, max: 3000, currency: "USD" },
  },
};

export function initialProgressStages(): ProgressStage[] {
  return progressLabels.map((label, index) => ({
    id: `stage-${index}`,
    label,
    state: "pending",
  }));
}

export function createDemoScan(): Scan {
  const scanId = "demo-overpass-b104";
  const sourceFiles = createDemoFiles(scanId);
  const seeds: FindingSeed[] = [
    {
      damageType: "crack",
      label: "Longitudinal crack along deck soffit",
      description:
        "A continuous dark line crosses the deck underside near midspan. The pattern suggests water-bearing movement rather than surface staining.",
      confidence: 0.87,
      bbox: { x: 0.43, y: 0.31, width: 0.18, height: 0.09 },
      position3d: { x: -1.1, y: 0.18, z: -0.8 },
      severityBoost: 11,
    },
    {
      damageType: "spalling",
      label: "Spalling near pier face",
      description:
        "Irregular missing cover and rough aggregate are visible near the support line.",
      confidence: 0.82,
      bbox: { x: 0.54, y: 0.57, width: 0.15, height: 0.13 },
      position3d: { x: 0.7, y: -1.2, z: 0.9 },
      severityBoost: 4,
    },
    {
      damageType: "water_leakage",
      label: "Water staining below expansion joint",
      description:
        "Vertical staining below the joint suggests recurring leakage and possible blocked drainage.",
      confidence: 0.78,
      bbox: { x: 0.67, y: 0.35, width: 0.13, height: 0.17 },
      position3d: { x: 1.7, y: 0.22, z: -1.2 },
    },
    {
      damageType: "corrosion",
      label: "Rust staining at bearing seat",
      description:
        "Orange-brown staining is concentrated near steel hardware and a support interface.",
      confidence: 0.74,
      bbox: { x: 0.27, y: 0.48, width: 0.16, height: 0.12 },
      position3d: { x: 3.0, y: -0.12, z: 1.18 },
    },
    {
      damageType: "surface_wear",
      label: "Surface wear along service edge",
      description:
        "Light surface deterioration is visible along a high-exposure edge and should be monitored.",
      confidence: 0.7,
      bbox: { x: 0.13, y: 0.63, width: 0.14, height: 0.11 },
      position3d: { x: -3.4, y: 0.26, z: 1.1 },
    },
  ];

  const findings = seeds.map((seed, index) =>
    enrichFinding(seed, {
      scanId,
      sourceFileId: sourceFiles[index < 2 ? 0 : index < 4 ? 1 : 2].id,
      assetType: "bridge",
      index,
      locationLabel: "Downtown corridor",
    }),
  );

  return finalizeScan({
    id: scanId,
    name: "Overpass B-104",
    assetType: "bridge",
    locationLabel: "Downtown corridor",
    notes: "Drone orbit with visible staining near joints.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "completed",
    sourceFileCount: sourceFiles.length,
    sourceFiles,
    findings,
    summary: emptySummary(),
    reportMarkdown: "",
  });
}

export function createUploadedScan(input: ScanInput): Scan {
  const scanId = makeId("scan");
  const files =
    input.sourceFiles.length > 0
      ? input.sourceFiles.map((file) => ({ ...file, scanId }))
      : createDemoFiles(scanId).slice(0, 1);
  const seeds = files.flatMap((file, fileIndex) =>
    createMockSeeds(file.fileName, fileIndex, input.assetType),
  );
  const findings = seeds.map((seed, index) =>
    enrichFinding(seed, {
      scanId,
      sourceFileId: files[index % files.length].id,
      assetType: input.assetType,
      index,
      locationLabel: input.locationLabel,
    }),
  );

  return finalizeScan({
    id: scanId,
    name: input.name || "Untitled structure scan",
    assetType: input.assetType,
    locationLabel: input.locationLabel || "Location not provided",
    notes: input.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "completed",
    sourceFileCount: files.length,
    sourceFiles: files,
    findings,
    summary: emptySummary(),
    reportMarkdown: "",
  });
}

export function createDraftScan(input: ScanInput): Scan {
  const scanId = "draft-scan";
  return finalizeScan({
    id: scanId,
    name: input.name || "New structure scan",
    assetType: input.assetType,
    locationLabel: input.locationLabel || "Location not provided",
    notes: input.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: input.sourceFiles.length > 0 ? "uploaded" : "idle",
    sourceFileCount: input.sourceFiles.length,
    sourceFiles: input.sourceFiles.map((file) => ({ ...file, scanId })),
    findings: [],
    summary: emptySummary(),
    reportMarkdown: "",
  });
}

export function buildReportMarkdown(scan: Scan): string {
  const lines = [
    "# BridgeSplat AI Inspection Summary",
    "",
    `Scan: ${scan.name}`,
    `Asset type: ${assetTypeLabel(scan.assetType)}`,
    `Location: ${scan.locationLabel || "Not provided"}`,
    `Date: ${new Date(scan.updatedAt).toLocaleString()}`,
    `Source files: ${scan.sourceFileCount}`,
    "",
    `Health Score: ${scan.summary.healthScore}/100`,
    `Sustainability Impact Score: ${scan.summary.sustainabilityScore}/100 (${scan.summary.sustainabilityImpact})`,
    `Total findings: ${scan.summary.totalFindings}`,
    `Urgent issues: ${scan.summary.urgentIssues}`,
    "",
    "## Executive Summary",
    scan.summary.executiveSummary,
    "",
    "## Priority Findings",
    "| Priority | Finding | Severity | Confidence | Timeframe | Estimated cost range | Sustainable recommendation |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...scan.findings
      .slice()
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map(
        (finding, index) =>
          `| ${index + 1} | ${finding.label} | ${finding.severityLevel} | ${Math.round(
            finding.confidence * 100,
          )}% | ${finding.timeframeLabel} | ${formatMoneyRange(
            finding.repairCostRange,
          )} | ${finding.sustainableSolution} |`,
      ),
    "",
    "## Repair Now vs Repair Later",
    `Estimated early repair range: ${formatMoneyRange(scan.summary.totalEstimatedCostRange)}`,
    `Estimated avoided material waste: ${formatKgRange(scan.summary.totalAvoidedWasteKgRange)}`,
    `Estimated avoided CO2e: ${formatKgRange(scan.summary.totalAvoidedCO2eKgRange)}`,
    "",
    "## Suggested Provider Categories",
    ...Array.from(new Set(scan.findings.map((finding) => finding.providerCategory))).map(
      (category) => `- ${category}`,
    ),
    "",
    "## Demo Assumptions",
    "- Values are deterministic hackathon estimates, not engineering quantities.",
    "- Sustainability ranges compare early localized repair against delayed intervention requiring more removal, replacement, hauling, and disposal.",
    "- Provider names are mock examples for demo purposes.",
    "",
    "## Disclaimer",
    "BridgeSplat AI provides AI-assisted inspection triage for demo purposes and is not a substitute for a licensed structural inspection or official authority review.",
  ];

  return lines.join("\n");
}

export function assetTypeLabel(assetType: AssetType): string {
  return assetType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function damageLabel(damageType: DamageType): string {
  return typeLabels[damageType];
}

export function formatMoneyRange(range: CostRange): string {
  return `$${formatCompact(range.min)}-$${formatCompact(range.max)}`;
}

export function formatKgRange(range: Range): string {
  return `${Math.round(range.min)}-${Math.round(range.max)} kg`;
}

export function statusLabel(finding: Finding): string {
  if (finding.severityLevel === "critical") return "Urgent follow-up";
  if (finding.severityLevel === "high") return "Repair soon";
  if (finding.severityLevel === "medium") return "Needs review";
  return "Monitor";
}

function enrichFinding(
  seed: FindingSeed,
  context: {
    scanId: string;
    sourceFileId: string;
    assetType: AssetType;
    index: number;
    locationLabel: string;
  },
): Finding {
  const areaFactor = seed.bbox.width * seed.bbox.height * 130;
  const confidenceFactor = seed.confidence * 16;
  const assetFactor =
    context.assetType === "bridge" || context.assetType === "parking_deck" ? 5 : 0;
  const severityScore = clamp(
    baseSeverity[seed.damageType] +
      areaFactor +
      confidenceFactor +
      assetFactor +
      (seed.severityBoost ?? 0),
    1,
    100,
  );
  const severityLevel = severityFromScore(severityScore);
  const rec = recommendations[seed.damageType];
  const multiplier = costMultiplier(context.assetType, seed.damageType, severityLevel);
  const repairCostRange = {
    min: Math.round(rec.cost.min * multiplier),
    max: Math.round(rec.cost.max * multiplier),
    currency: "USD" as const,
  };
  const avoidedWasteKgRange = estimateAvoidedWaste(severityLevel, seed.damageType, context.assetType);
  const avoidedCO2eKgRange = {
    min: Math.round(avoidedWasteKgRange.min * 0.28),
    max: Math.round(avoidedWasteKgRange.max * 0.42),
  };
  const priorityScore = clamp(
    severityScore * 0.62 +
      seed.confidence * 22 +
      Math.min(18, avoidedCO2eKgRange.max / 35),
    1,
    100,
  );

  return {
    id: `${context.scanId}-finding-${context.index + 1}`,
    scanId: context.scanId,
    sourceFileId: context.sourceFileId,
    damageType: seed.damageType,
    label: seed.label,
    description: seed.description,
    confidence: seed.confidence,
    severityLevel,
    severityScore: Math.round(severityScore),
    priorityScore: Math.round(priorityScore),
    bbox: seed.bbox,
    position3d: seed.position3d,
    areaSqFtRange: {
      min: Number((seed.bbox.width * seed.bbox.height * 28).toFixed(1)),
      max: Number((seed.bbox.width * seed.bbox.height * 54).toFixed(1)),
    },
    repairCostRange,
    timeframeLabel: timeframeForSeverity(severityLevel),
    urgency: urgencyForSeverity(severityLevel),
    likelyCause: rec.likelyCause,
    recommendedAction: rec.recommendedAction,
    sustainableSolution: rec.sustainableSolution,
    providerCategory: rec.providerCategory,
    localProviders: providersFor(rec.providerCategory, context.locationLabel, context.index),
    avoidedWasteKgRange,
    avoidedCO2eKgRange,
    assumptions: [
      "Scenario estimate based on visible area, damage type, severity, and asset type.",
      "Avoided waste compares localized repair now against delayed repair requiring more material removal.",
    ],
  };
}

function finalizeScan(scan: Scan): Scan {
  const summary = summarize(scan.findings);
  const finalized = {
    ...scan,
    sourceFileCount: scan.sourceFiles.length,
    summary,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...finalized,
    reportMarkdown: buildReportMarkdown(finalized),
  };
}

function summarize(findings: Finding[]): ScanSummary {
  const sorted = findings.slice().sort((a, b) => b.priorityScore - a.priorityScore);
  const totalEstimatedCostRange = sumCost(findings.map((finding) => finding.repairCostRange));
  const totalAvoidedWasteKgRange = sumRange(
    findings.map((finding) => finding.avoidedWasteKgRange),
  );
  const totalAvoidedCO2eKgRange = sumRange(
    findings.map((finding) => finding.avoidedCO2eKgRange),
  );
  const healthPenalty = findings.reduce((sum, finding) => {
    const penalty = {
      low: 4,
      medium: 9,
      high: 16,
      critical: 28,
    }[finding.severityLevel];
    return sum + penalty + finding.confidence * 2;
  }, 0);
  const healthScore = Math.round(clamp(100 - healthPenalty, 0, 100));
  const sustainabilityScore = Math.round(
    clamp(totalAvoidedCO2eKgRange.max / 8 + findings.length * 7, 0, 100),
  );
  const sustainabilityImpact =
    sustainabilityScore >= 62 ? "high" : sustainabilityScore >= 34 ? "medium" : "low";
  const criticalCount = findings.filter((finding) => finding.severityLevel === "critical").length;
  const highCount = findings.filter((finding) => finding.severityLevel === "high").length;
  const mediumCount = findings.filter((finding) => finding.severityLevel === "medium").length;
  const lowCount = findings.filter((finding) => finding.severityLevel === "low").length;
  const urgentIssues = criticalCount + highCount;

  return {
    totalFindings: findings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    urgentIssues,
    topPriorityFindingId: sorted[0]?.id ?? null,
    recommendedNextStep:
      criticalCount > 0
        ? "Immediate engineer review recommended"
        : highCount > 0
          ? "Schedule targeted repair review within 14 days"
          : mediumCount > 0
            ? "Create a maintenance work order within 30-90 days"
            : "Continue monitoring on the next inspection cycle",
    recommendedTimeframe:
      criticalCount > 0 ? "Immediate" : highCount > 0 ? "Within 14 days" : "30-90 days",
    totalEstimatedCostRange,
    totalAvoidedWasteKgRange,
    totalAvoidedCO2eKgRange,
    healthScore,
    sustainabilityScore,
    sustainabilityImpact,
    executiveSummary:
      findings.length === 0
        ? "No visible priority damage has been detected yet. Upload photos or load the sample bridge to generate inspection triage."
        : `${findings.length} visible issue${
            findings.length === 1 ? "" : "s"
          } were mapped across the structure. Early localized repair could avoid ${formatKgRange(
            totalAvoidedWasteKgRange,
          )} of additional material handling and ${formatKgRange(
            totalAvoidedCO2eKgRange,
          )} CO2e in this scenario estimate.`,
  };
}

function createDemoFiles(scanId: string): SourceFile[] {
  return [
    {
      id: `${scanId}-file-1`,
      scanId,
      fileName: "deck-soffit-orbit.jpg",
      fileType: "image/svg+xml",
      previewUrl: svgDataUri("Deck soffit", "#222", "#d6d3c7", "#ff315f"),
      uploadedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: `${scanId}-file-2`,
      scanId,
      fileName: "bearing-seat-closeup.jpg",
      fileType: "image/svg+xml",
      previewUrl: svgDataUri("Bearing seat", "#1f2627", "#c5cbc8", "#008c95"),
      uploadedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: `${scanId}-file-3`,
      scanId,
      fileName: "edge-drainage-view.jpg",
      fileType: "image/svg+xml",
      previewUrl: svgDataUri("Drainage edge", "#24211f", "#bfc4bb", "#bf6a16"),
      uploadedAt: new Date().toISOString(),
      isDemo: true,
    },
  ];
}

function createMockSeeds(fileName: string, fileIndex: number, assetType: AssetType): FindingSeed[] {
  const seed = hash(fileName) + fileIndex * 31;
  const damageTypes: DamageType[] =
    assetType === "road"
      ? ["surface_wear", "crack", "water_leakage"]
      : ["crack", "water_leakage", "corrosion", "spalling", "missing_concrete"];
  const count = 1 + (seed % 3);

  return Array.from({ length: count }, (_, index) => {
    const type = damageTypes[(seed + index * 2) % damageTypes.length];
    const confidence = Number((0.66 + ((seed + index * 17) % 26) / 100).toFixed(2));
    const x = 0.08 + (((seed + index * 13) % 68) / 100);
    const y = 0.14 + (((seed + index * 19) % 58) / 100);
    return {
      damageType: type,
      label: `${typeLabels[type]} candidate`,
      description: `Prototype vision flagged a ${typeLabels[type].toLowerCase()} pattern in this uploaded view.`,
      confidence,
      bbox: {
        x: clamp(x, 0.06, 0.78),
        y: clamp(y, 0.08, 0.74),
        width: 0.12 + ((seed + index * 7) % 10) / 100,
        height: 0.1 + ((seed + index * 11) % 9) / 100,
      },
      position3d: {
        x: Number((((x - 0.5) * 9.4)).toFixed(2)),
        y: type === "spalling" || type === "missing_concrete" ? -1.1 : 0.2,
        z: Number((((y - 0.5) * 3.4)).toFixed(2)),
      },
      severityBoost: fileIndex === 0 && index === 0 ? 10 : 0,
    };
  });
}

function emptySummary(): ScanSummary {
  return {
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    urgentIssues: 0,
    topPriorityFindingId: null,
    recommendedNextStep: "Upload photos or run the demo scan",
    recommendedTimeframe: "Not started",
    totalEstimatedCostRange: { min: 0, max: 0, currency: "USD" },
    totalAvoidedWasteKgRange: { min: 0, max: 0 },
    totalAvoidedCO2eKgRange: { min: 0, max: 0 },
    healthScore: 100,
    sustainabilityScore: 0,
    sustainabilityImpact: "low",
    executiveSummary:
      "Upload inspection photos or run the deterministic demo scan to generate findings.",
  };
}

function severityFromScore(score: number): SeverityLevel {
  if (score >= 85) return "critical";
  if (score >= 61) return "high";
  if (score >= 31) return "medium";
  return "low";
}

function urgencyForSeverity(severity: SeverityLevel): Urgency {
  if (severity === "critical") return "immediate";
  if (severity === "high") return "within_14_days";
  if (severity === "medium") return "within_90_days";
  return "monitor";
}

function timeframeForSeverity(severity: SeverityLevel): string {
  if (severity === "critical") return "Immediate engineer review";
  if (severity === "high") return "Repair review within 14 days";
  if (severity === "medium") return "Address within 30-90 days";
  return "Monitor next cycle";
}

function estimateAvoidedWaste(
  severity: SeverityLevel,
  type: DamageType,
  assetType: AssetType,
): Range {
  const base: Record<SeverityLevel, Range> = {
    low: { min: 10, max: 50 },
    medium: { min: 50, max: 200 },
    high: { min: 200, max: 800 },
    critical: { min: 800, max: 2500 },
  };
  let multiplier = 1;
  if (assetType === "bridge" || assetType === "parking_deck") multiplier += 0.22;
  if (type === "spalling" || type === "missing_concrete") multiplier += 0.28;
  if (type === "corrosion") multiplier += 0.12;
  if (type === "surface_wear") multiplier -= 0.2;

  return {
    min: Math.round(base[severity].min * multiplier),
    max: Math.round(base[severity].max * multiplier),
  };
}

function costMultiplier(assetType: AssetType, type: DamageType, severity: SeverityLevel): number {
  let multiplier = 1;
  if (assetType === "bridge" || assetType === "parking_deck") multiplier += 0.18;
  if (type === "spalling" || type === "missing_concrete") multiplier += 0.18;
  if (severity === "high") multiplier += 0.24;
  if (severity === "critical") multiplier += 0.72;
  if (severity === "low") multiplier -= 0.18;
  return Math.max(0.55, multiplier);
}

function providersFor(category: string, locationLabel: string, index: number): LocalProvider[] {
  const suffix = locationLabel && locationLabel !== "Location not provided" ? locationLabel : "local";
  const providers = [
    "GreenSeal Concrete Repair",
    "Metro Infrastructure Maintenance",
    "Low-Carbon Materials Partner",
    "Bridge Deck Restoration Co.",
  ];

  return [0, 1, 2].map((offset) => ({
    id: `provider-${index}-${offset}`,
    name: providers[(index + offset) % providers.length],
    category,
    distanceLabel: offset === 0 ? `near ${suffix}` : offset === 1 ? "regional" : "local",
    sustainabilityTags:
      offset === 0
        ? ["local crew", "low-material repair"]
        : offset === 1
          ? ["waterproofing specialist", "targeted repair"]
          : ["low-carbon materials", "concrete restoration"],
    estimatedFit: offset === 0 ? "High fit" : "Good fit",
    isMock: true,
  }));
}

function svgDataUri(title: string, background: string, concrete: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${background}"/>
          <stop offset="1" stop-color="#050505"/>
        </linearGradient>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M80 0H0v80" fill="none" stroke="#2e3434" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1400" height="900" fill="url(#sky)"/>
      <rect y="500" width="1400" height="400" fill="url(#grid)" opacity=".65"/>
      <g transform="translate(130 210) skewY(-8)">
        <rect x="60" y="160" width="1080" height="220" fill="${concrete}"/>
        <rect x="85" y="184" width="1030" height="110" fill="#202322"/>
        <rect x="90" y="300" width="1030" height="18" fill="#e9e4cd"/>
        <rect x="70" y="120" width="1120" height="34" fill="#9ba4a1"/>
        <rect x="70" y="380" width="1120" height="38" fill="#818a86"/>
        <g stroke="#8c9692" stroke-width="18">
          <path d="M100 82h1020"/>
          <path d="M100 122h1020"/>
          <path d="M120 80v120M260 80v120M400 80v120M540 80v120M680 80v120M820 80v120M960 80v120M1100 80v120"/>
        </g>
        <g fill="#b6b9b0">
          <polygon points="210,420 320,420 280,690 170,690"/>
          <polygon points="780,420 900,420 955,690 835,690"/>
          <polygon points="1130,420 1290,420 1400,700 1240,700"/>
        </g>
      </g>
      <circle cx="1160" cy="220" r="80" fill="${accent}" opacity=".15"/>
      <text x="54" y="72" fill="#f8faf7" font-family="Inter, Arial" font-size="34" font-weight="800">${title}</text>
      <text x="56" y="112" fill="#bfc7c2" font-family="Inter, Arial" font-size="18">Sample inspection view / deterministic tags</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function sumRange(ranges: Range[]): Range {
  return ranges.reduce(
    (sum, range) => ({ min: sum.min + range.min, max: sum.max + range.max }),
    { min: 0, max: 0 },
  );
}

function sumCost(ranges: CostRange[]): CostRange {
  const sum = sumRange(ranges);
  return { ...sum, currency: "USD" };
}

function formatCompact(value: number): string {
  if (value >= 1000) return `${Number((value / 1000).toFixed(value >= 10000 ? 0 : 1))}k`;
  return String(Math.round(value));
}

function hash(value: string): number {
  return value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function makeId(prefix: string): string {
  if ("crypto" in window && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
