import type { DamageIssue, InspectionResult, IssueSeverity } from "../types";

export const issueStyles: Record<
  DamageIssue["type"],
  { label: string; color: string; soft: string }
> = {
  crack: { label: "Crack", color: "#ff315f", soft: "#ffe0e8" },
  corrosion: { label: "Corrosion", color: "#bf6a16", soft: "#f8ead8" },
  spalling: { label: "Spalling", color: "#6f5cff", soft: "#e9e5ff" },
  water: { label: "Water Staining", color: "#008c95", soft: "#dff5f5" },
};

export const severityRank: Record<IssueSeverity, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export const sampleIssues: DamageIssue[] = [
  {
    id: "issue-crack-deck-01",
    type: "crack",
    severity: "high",
    confidence: 0.91,
    title: "Longitudinal crack along deck soffit",
    component: "Deck underside",
    summary:
      "A narrow, continuous crack pattern is visible near the center span. The shape suggests active movement rather than surface discoloration.",
    recommendation:
      "Schedule close visual inspection and seal the crack before the next freeze-thaw cycle. Verify whether reinforcement is exposed.",
    frameReference: "Frame 024",
    normalizedImagePoint: { x: 0.39, y: 0.56 },
    position: { x: -1.2, y: 0.18, z: -0.84 },
    areaSqFt: 3.2,
    priority: 92,
  },
  {
    id: "issue-corrosion-bearing-02",
    type: "corrosion",
    severity: "moderate",
    confidence: 0.84,
    title: "Rust staining around bearing seat",
    component: "Right bearing seat",
    summary:
      "Orange-brown staining is concentrated near the support interface, consistent with moisture retention around steel hardware.",
    recommendation:
      "Clean and coat affected steel. Inspect drainage and verify that water is not ponding at the bearing.",
    frameReference: "Frame 031",
    normalizedImagePoint: { x: 0.72, y: 0.47 },
    position: { x: 3.0, y: -0.12, z: 1.18 },
    areaSqFt: 1.8,
    priority: 73,
  },
  {
    id: "issue-spalling-pier-03",
    type: "spalling",
    severity: "high",
    confidence: 0.87,
    title: "Concrete spalling on pier face",
    component: "Pier 2",
    summary:
      "Irregular exposed aggregate and missing cover are present on the pier face below the deck line.",
    recommendation:
      "Patch spalled concrete after sounding the surrounding area. Check for reinforcement corrosion before repair.",
    frameReference: "Frame 044",
    normalizedImagePoint: { x: 0.53, y: 0.7 },
    position: { x: 0.7, y: -1.2, z: 0.92 },
    areaSqFt: 4.4,
    priority: 88,
  },
  {
    id: "issue-water-joint-04",
    type: "water",
    severity: "moderate",
    confidence: 0.8,
    title: "Water staining below expansion joint",
    component: "Expansion joint",
    summary:
      "Vertical staining below the joint suggests recurring leakage and possible debris blockage in the drainage path.",
    recommendation:
      "Clear joint debris and inspect the seal. Recheck after rainfall to confirm that leakage has stopped.",
    frameReference: "Frame 052",
    normalizedImagePoint: { x: 0.58, y: 0.36 },
    position: { x: 1.6, y: 0.22, z: -1.24 },
    areaSqFt: 2.6,
    priority: 68,
  },
];

export function createSampleInspection(): InspectionResult {
  return {
    id: "sample-inspection",
    createdAt: new Date().toISOString(),
    assetName: "Demo Overpass B-104",
    inputName: "sample-drone-orbit.mp4",
    inputKind: "sample",
    healthScore: 64,
    riskLevel: "high",
    status: "complete",
    issues: sampleIssues,
    summary:
      "Four priority defects were mapped across the deck, bearing seat, pier face, and expansion joint. The structure remains serviceable, but targeted maintenance should be scheduled soon.",
    recommendation:
      "Run a hands-on inspection within 14 days, prioritize deck crack sealing and pier patching, then repeat the scan after repairs to confirm stabilization.",
    carbonNote:
      "Targeted repair is the recommended intervention. Extending the useful life of the existing deck and pier avoids the high embodied carbon of premature replacement.",
    model: {
      type: "digital-twin-preview",
      description:
        "Interactive inspection twin with damage markers projected into 3D bridge coordinates. Swap this layer with a generated Gaussian Splat when the reconstruction pipeline is connected.",
      sourceFrames: 64,
      reconstructionConfidence: 0.82,
    },
  };
}
