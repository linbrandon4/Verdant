import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  Clipboard,
  Download,
  FileJson,
  Leaf,
  MapPin,
  Play,
  UploadCloud,
} from "lucide-react";
import {
  assetTypeLabel,
  buildReportMarkdown,
  createDemoScan,
  createDraftScan,
  createUploadedScan,
  damageLabel,
  formatKgRange,
  formatMoneyRange,
  initialProgressStages,
  statusLabel,
} from "./lib/inspectionLogic";
import type { AssetType, Finding, ProgressStage, Scan, SourceFile } from "./types";

const assetTypeOptions: Array<{ value: AssetType; label: string }> = [
  { value: "bridge", label: "Bridge" },
  { value: "parking_deck", label: "Parking deck" },
  { value: "road", label: "Road" },
  { value: "building", label: "Building" },
  { value: "retaining_wall", label: "Retaining wall" },
  { value: "other_concrete", label: "Other concrete structure" },
];

export default function App() {
  const [scan, setScan] = useState<Scan>(() => createDemoScan());
  const [projectName, setProjectName] = useState("Overpass B-104");
  const [assetType, setAssetType] = useState<AssetType>("bridge");
  const [locationLabel, setLocationLabel] = useState("Downtown corridor");
  const [notes, setNotes] = useState("Drone orbit with visible staining near joints.");
  const [selectedFileId, setSelectedFileId] = useState<string>(() => scan.sourceFiles[0]?.id ?? "");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    scan.summary.topPriorityFindingId,
  );
  const [progressStages, setProgressStages] = useState<ProgressStage[]>(() =>
    initialProgressStages().map((stage) => ({ ...stage, state: "complete" })),
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [reportOpen, setReportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const selectedFile = useMemo(
    () => scan.sourceFiles.find((file) => file.id === selectedFileId) ?? scan.sourceFiles[0],
    [scan.sourceFiles, selectedFileId],
  );

  const findingsForFile = useMemo(
    () => scan.findings.filter((finding) => finding.sourceFileId === selectedFile?.id),
    [scan.findings, selectedFile?.id],
  );

  const selectedFinding = useMemo(
    () =>
      scan.findings.find((finding) => finding.id === selectedFindingId) ??
      findingsForFile[0] ??
      scan.findings[0],
    [findingsForFile, scan.findings, selectedFindingId],
  );

  useEffect(() => {
    setSelectedFileId((current) => current || scan.sourceFiles[0]?.id || "");
    setSelectedFindingId(scan.summary.topPriorityFindingId ?? scan.findings[0]?.id ?? null);
  }, [scan.id, scan.findings, scan.sourceFiles, scan.summary.topPriorityFindingId]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const updateDraftScan = (files: SourceFile[]) => {
    const draft = createDraftScan({
      name: projectName,
      assetType,
      locationLabel,
      notes,
      sourceFiles: files,
    });
    setScan(draft);
    setSelectedFileId(draft.sourceFiles[0]?.id ?? "");
    setSelectedFindingId(null);
    setReportOpen(false);
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];

    const sourceFiles: SourceFile[] = files.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);
      return {
        id: `upload-${Date.now()}-${index}`,
        scanId: "draft-scan",
        fileName: file.name,
        fileType: file.type,
        previewUrl,
        uploadedAt: new Date().toISOString(),
      };
    });

    updateDraftScan(sourceFiles);
  };

  const runAnalysis = async (mode: "demo" | "uploaded") => {
    setIsAnalyzing(true);
    setReportOpen(false);
    setCopyState("idle");
    const stages = initialProgressStages();
    setProgressStages(stages);

    for (let index = 0; index < stages.length; index += 1) {
      setProgressStages(
        stages.map((stage, stageIndex) => ({
          ...stage,
          state:
            stageIndex < index ? "complete" : stageIndex === index ? "running" : "pending",
        })),
      );
      await delay(index === 0 ? 280 : 430);
    }

    setProgressStages(stages.map((stage) => ({ ...stage, state: "complete" })));
    const nextScan =
      mode === "demo" || scan.sourceFiles.length === 0
        ? createDemoScan()
        : createUploadedScan({
            name: projectName,
            assetType,
            locationLabel,
            notes,
            sourceFiles: scan.sourceFiles,
          });

    setScan(nextScan);
    setSelectedFileId(nextScan.sourceFiles[0]?.id ?? "");
    setSelectedFindingId(nextScan.summary.topPriorityFindingId ?? nextScan.findings[0]?.id ?? null);
    setProjectName(nextScan.name);
    setAssetType(nextScan.assetType);
    setLocationLabel(nextScan.locationLabel);
    setNotes(nextScan.notes);
    setIsAnalyzing(false);
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReportMarkdown(scan));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1400);
    }
  };

  const handleExportReport = () => {
    downloadText(`${scan.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.md`, scan.reportMarkdown);
  };

  const handleExportJson = () => {
    downloadText(
      `${scan.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-inspection.json`,
      JSON.stringify(scan, null, 2),
      "application/json",
    );
  };

  return (
    <main className="app-shell">
      <header className="hero-strip">
        <div className="hero-copy">
          <div className="hero-brand">
            <div className="brand-symbol" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <span>BridgeSplat AI</span>
          </div>
          <h1>Find the small failure before it becomes the whole bridge.</h1>
          <p>
            BridgeSplat turns field photos into a marked-up structure, repair queue,
            and carbon case for early repair.
          </p>
        </div>

        <div className="hero-flow" aria-label="Inspection workflow">
          {["Capture", "Rebuild", "Tag", "Rank", "Report"].map((step, index) => (
            <div key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </header>

      <section className="metric-grid" aria-label="Scan metrics">
        <MetricCard label="Health score" value={`${scan.summary.healthScore}`} detail="/100" tone="dark" />
        <MetricCard
          label="Sustainability"
          value={`${scan.summary.sustainabilityScore}`}
          detail={`${scan.summary.sustainabilityImpact} impact`}
          tone="green"
        />
        <MetricCard label="Findings" value={`${scan.summary.totalFindings}`} detail="visible issues" />
        <MetricCard label="Urgent" value={`${scan.summary.urgentIssues}`} detail="high priority" tone="risk" />
        <MetricCard
          label="Repair range"
          value={formatMoneyRange(scan.summary.totalEstimatedCostRange)}
          detail="field estimate"
        />
        <MetricCard
          label="Avoided CO2e"
          value={formatKgRange(scan.summary.totalAvoidedCO2eKgRange)}
          detail="repair early"
          tone="green"
        />
      </section>

      <section className="workspace">
        <aside className="setup-panel">
          <section className="panel-section">
            <SectionTitle icon={<Camera size={18} />} label="Inspection setup" />
            <label className="field-label">
              Project name
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label className="field-label">
              Asset type
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value as AssetType)}
              >
                {assetTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Location
              <input
                value={locationLabel}
                onChange={(event) => setLocationLabel(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="field-label">
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>

            <label
              className={`upload-zone ${isDragging ? "dragging" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleFiles(event.dataTransfer.files);
              }}
            >
              <UploadCloud size={28} />
              <strong>Drop bulk inspection photos</strong>
              <span>Multiple JPG/PNG files supported</span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) handleFiles(event.target.files);
                }}
              />
            </label>

            <div className="button-row">
              <button
                className="primary-button"
                disabled={isAnalyzing}
                onClick={() => void runAnalysis(scan.sourceFiles.length > 0 ? "uploaded" : "demo")}
              >
                <Play size={17} />
                {isAnalyzing ? "Analyzing" : "Analyze photos"}
              </button>
              <button
                className="ghost-button"
                disabled={isAnalyzing}
                onClick={() => void runAnalysis("demo")}
              >
                Sample scan
              </button>
            </div>
          </section>

          <section className="panel-section">
            <SectionTitle icon={<BarChart3 size={18} />} label="Analysis pipeline" />
            <div className="stage-list">
              {progressStages.map((stage) => (
                <div className={`stage-row ${stage.state}`} key={stage.id}>
                  <div className="stage-dot">
                    {stage.state === "complete" ? <CheckCircle2 size={16} /> : null}
                  </div>
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="viewer-panel">
          <div className="viewer-header">
            <div>
              <span>{assetTypeLabel(scan.assetType)}</span>
              <strong>{scan.name}</strong>
            </div>
            <small>
              {scan.sourceFileCount} photo{scan.sourceFileCount === 1 ? "" : "s"} /{" "}
              {scan.summary.totalFindings} finding{scan.summary.totalFindings === 1 ? "" : "s"}
            </small>
          </div>

          <div className="inspection-viewer">
            {selectedFile ? (
              <>
                <img alt={selectedFile.fileName} src={selectedFile.previewUrl} />
                {findingsForFile.map((finding) => (
                  <button
                    className={`damage-box ${finding.severityLevel} ${
                      finding.id === selectedFinding?.id ? "selected" : ""
                    }`}
                    key={finding.id}
                    onClick={() => setSelectedFindingId(finding.id)}
                    style={{
                      left: `${finding.bbox.x * 100}%`,
                      top: `${finding.bbox.y * 100}%`,
                      width: `${finding.bbox.width * 100}%`,
                      height: `${finding.bbox.height * 100}%`,
                    }}
                  >
                    <span>
                      {damageLabel(finding.damageType)} / {Math.round(finding.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <div className="empty-viewer">
                <UploadCloud size={34} />
                <strong>Drop in photos or load the sample bridge.</strong>
              </div>
            )}
          </div>

          <div className="thumbnail-strip">
            {scan.sourceFiles.map((file) => {
              const count = scan.findings.filter((finding) => finding.sourceFileId === file.id).length;
              return (
                <button
                  className={file.id === selectedFile?.id ? "active" : ""}
                  key={file.id}
                  onClick={() => {
                    setSelectedFileId(file.id);
                    const firstFinding = scan.findings.find((finding) => finding.sourceFileId === file.id);
                    if (firstFinding) setSelectedFindingId(firstFinding.id);
                  }}
                >
                  <img alt="" src={file.previewUrl} />
                  <span>{file.fileName}</span>
                  <em>{count} tags</em>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="insight-panel">
          <section className="score-section">
            <div className="score-header">
              <div>
                <span className="eyebrow">Inspection brief</span>
                <h2>{scan.summary.recommendedNextStep}</h2>
              </div>
              <span className={`risk-badge ${scan.summary.urgentIssues > 0 ? "high" : "medium"}`}>
                {scan.summary.recommendedTimeframe}
              </span>
            </div>
            <p>{scan.summary.executiveSummary}</p>
          </section>

          {selectedFinding ? (
            <FindingDetails finding={selectedFinding} locationLabel={scan.locationLabel} />
          ) : (
            <section className="detail-card">
              <AlertTriangle size={20} />
              <h3>No finding selected</h3>
              <p>Analyze photos and click a highlighted damage area.</p>
            </section>
          )}
        </aside>
      </section>

      <section className="lower-grid">
        <PriorityList
          findings={scan.findings}
          selectedFindingId={selectedFinding?.id ?? null}
          onSelect={(finding) => {
            setSelectedFindingId(finding.id);
            setSelectedFileId(finding.sourceFileId);
          }}
        />

        <SustainabilityComparison scan={scan} />

        <section className="report-panel">
          <div className="section-heading">
            <div>
              <span>Report</span>
              <h2>Field report package</h2>
            </div>
            <button className="ghost-button" onClick={() => setReportOpen((open) => !open)}>
              {reportOpen ? "Hide" : "Preview"}
            </button>
          </div>
          <p>
            Download the marked findings, repair order, cost ranges, sustainability
            assumptions, and inspection caveats.
          </p>
          <div className="button-row">
            <button className="primary-button" onClick={handleExportReport}>
              <Download size={17} />
              Export MD
            </button>
            <button className="ghost-button" onClick={handleCopyReport}>
              <Clipboard size={16} />
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
            </button>
            <button className="ghost-button" onClick={handleExportJson}>
              <FileJson size={16} />
              JSON
            </button>
          </div>
          {reportOpen ? <pre>{scan.reportMarkdown}</pre> : null}
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "dark" | "green" | "risk";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="section-title">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function FindingDetails({ finding, locationLabel }: { finding: Finding; locationLabel: string }) {
  return (
    <section className="detail-card">
      <div className="detail-heading">
        <span>{damageLabel(finding.damageType)}</span>
        <em className={`severity ${finding.severityLevel}`}>{finding.severityLevel}</em>
      </div>
      <h3>{finding.label}</h3>
      <p>{finding.description}</p>

      <dl className="finding-facts">
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(finding.confidence * 100)}%</dd>
        </div>
        <div>
          <dt>Timeframe</dt>
          <dd>{finding.timeframeLabel}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>
            {finding.areaSqFtRange.min}-{finding.areaSqFtRange.max} sq ft
          </dd>
        </div>
        <div>
          <dt>Cost range</dt>
          <dd>{formatMoneyRange(finding.repairCostRange)}</dd>
        </div>
      </dl>

      <div className="recommendation-block">
        <strong>Recommended action</strong>
        <p>{finding.recommendedAction}</p>
      </div>
      <div className="recommendation-block green">
        <strong>Sustainable repair option</strong>
        <p>{finding.sustainableSolution}</p>
      </div>

      <div className="impact-strip">
        <div>
          <span>Avoided waste</span>
          <strong>{formatKgRange(finding.avoidedWasteKgRange)}</strong>
        </div>
        <div>
          <span>Avoided CO2e</span>
          <strong>{formatKgRange(finding.avoidedCO2eKgRange)}</strong>
        </div>
      </div>

      <div className="provider-box">
        <strong>Suggested provider type</strong>
        <p>{finding.providerCategory}</p>
        <small>
          Suggested local search: {finding.providerCategory} near{" "}
          {locationLabel || "this structure"}
        </small>
        <div>
          {finding.localProviders.slice(0, 2).map((provider) => (
            <span key={provider.id}>{provider.name}</span>
          ))}
        </div>
      </div>

      <div className="assumption-note">
        Scenario assumption: early localized repair may prevent additional removal,
        hauling, and replacement material.
      </div>
    </section>
  );
}

function PriorityList({
  findings,
  selectedFindingId,
  onSelect,
}: {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelect: (finding: Finding) => void;
}) {
  const sorted = findings.slice().sort((a, b) => b.priorityScore - a.priorityScore);
  return (
    <section className="priority-panel">
      <div className="section-heading">
        <div>
          <span>Repair order</span>
          <h2>Priority findings</h2>
        </div>
      </div>
      <div className="priority-table">
        {sorted.map((finding, index) => (
          <button
            className={finding.id === selectedFindingId ? "selected" : ""}
            key={finding.id}
            onClick={() => onSelect(finding)}
          >
            <span>{index + 1}</span>
            <strong>{finding.label}</strong>
            <em className={`severity ${finding.severityLevel}`}>{finding.severityLevel}</em>
            <small>{Math.round(finding.confidence * 100)}%</small>
            <small>{finding.timeframeLabel}</small>
            <small>{formatMoneyRange(finding.repairCostRange)}</small>
            <small>{statusLabel(finding)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function SustainabilityComparison({ scan }: { scan: Scan }) {
  const laterCost = {
    min: Math.round(scan.summary.totalEstimatedCostRange.min * 2.4),
    max: Math.round(scan.summary.totalEstimatedCostRange.max * 3.6),
    currency: "USD" as const,
  };
  const laterWaste = {
    min: Math.round(scan.summary.totalAvoidedWasteKgRange.min * 1.9),
    max: Math.round(scan.summary.totalAvoidedWasteKgRange.max * 2.5),
  };

  return (
    <section className="sustainability-panel">
      <div className="section-heading">
        <div>
          <span>Why early repair matters</span>
          <h2>Repair now vs repair later</h2>
        </div>
        <Leaf size={24} />
      </div>
      <p>
        Early localized repairs use less concrete, steel, hauling, and demolition
        than delayed reconstruction. The point is simple: fix the contained problem
        before the repair footprint expands.
      </p>
      <div className="comparison-grid">
        <article>
          <h3>Repair now</h3>
          <ul>
            <li>Localized repair</li>
            <li>Lower material use</li>
            <li>Lower disruption</li>
          </ul>
          <strong>{formatMoneyRange(scan.summary.totalEstimatedCostRange)}</strong>
        </article>
        <article>
          <h3>Repair later</h3>
          <ul>
            <li>Larger damaged area</li>
            <li>More demolition waste</li>
            <li>Higher embodied carbon</li>
          </ul>
          <strong>{formatMoneyRange(laterCost)}</strong>
        </article>
      </div>
      <div className="impact-bars">
        <ImpactBar label="Cost" now={42} later={100} />
        <ImpactBar label="Material waste" now={38} later={100} />
        <ImpactBar label="CO2e impact" now={35} later={100} />
        <ImpactBar label="Disruption" now={28} later={100} />
      </div>
      <div className="assumption-note">
        Estimated avoided material: {formatKgRange(scan.summary.totalAvoidedWasteKgRange)}.
        Delayed intervention could involve roughly {formatKgRange(laterWaste)} additional
        material handling in this sample scenario.
      </div>
    </section>
  );
}

function ImpactBar({ label, now, later }: { label: string; now: number; later: number }) {
  return (
    <div className="impact-bar">
      <span>{label}</span>
      <div>
        <i style={{ width: `${now}%` }} />
        <b style={{ width: `${later}%` }} />
      </div>
    </div>
  );
}

function downloadText(fileName: string, text: string, type = "text/markdown;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
