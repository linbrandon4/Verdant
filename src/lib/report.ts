import { issueStyles } from "../data/sampleInspection";
import type { InspectionResult } from "../types";

export function buildMarkdownReport(result: InspectionResult): string {
  const lines = [
    `# BridgeSplat AI Inspection Report`,
    ``,
    `Asset: ${result.assetName}`,
    `Input: ${result.inputName}`,
    `Created: ${new Date(result.createdAt).toLocaleString()}`,
    `Health Score: ${result.healthScore}/100`,
    `Risk Level: ${result.riskLevel.toUpperCase()}`,
    ``,
    `## Summary`,
    result.summary,
    ``,
    `## Recommendation`,
    result.recommendation,
    ``,
    `## Detected Issues`,
  ];

  result.issues.forEach((issue, index) => {
    lines.push(
      ``,
      `${index + 1}. ${issue.title}`,
      `   - Type: ${issueStyles[issue.type].label}`,
      `   - Severity: ${issue.severity}`,
      `   - Confidence: ${Math.round(issue.confidence * 100)}%`,
      `   - Component: ${issue.component}`,
      `   - 3D Location: x=${issue.position.x}, y=${issue.position.y}, z=${issue.position.z}`,
      `   - Action: ${issue.recommendation}`,
    );
  });

  lines.push(``, `## Sustainability Note`, result.carbonNote);
  return lines.join("\n");
}

export function downloadReport(result: InspectionResult) {
  const report = buildMarkdownReport(result);
  const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.assetName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-inspection.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
