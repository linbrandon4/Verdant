import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  FileDown,
  Globe2,
  Leaf,
  MapPin,
  Play,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import BridgeScene from "./components/BridgeScene";
import { createSampleInspection, issueStyles, severityRank } from "./data/sampleInspection";
import { initialStages, runInspection } from "./lib/analyzer";
import { buildMarkdownReport, downloadReport } from "./lib/report";
import type { DamageIssue, InspectionResult, IssueSeverity, StageProgress } from "./types";

const completedStages = () =>
  initialStages().map((stage) => ({
    ...stage,
    state: "complete" as const,
  }));

export default function App() {
  const [result, setResult] = useState<InspectionResult>(() => createSampleInspection());
  const [stages, setStages] = useState<StageProgress[]>(() => completedStages());
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(
    result.issues[0]?.id ?? null,
  );
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isUploadedResult = result.inputKind !== "sample";

  const selectedIssue = useMemo(
    () => result.issues.find((issue) => issue.id === selectedIssueId) ?? result.issues[0],
    [result.issues, selectedIssueId],
  );

  useEffect(() => {
    setSelectedIssueId(result.issues[0]?.id ?? null);
  }, [result.id]);

  const handleRun = async (targetFile: File | null) => {
    setIsProcessing(true);
    setCopyState("idle");
    setStages(initialStages());
    try {
      const next = await runInspection(targetFile, setStages);
      setResult(next);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFile = (nextFile: File | null) => {
    if (!nextFile) return;
    setFile(nextFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files[0] ?? null);
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdownReport(result));
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1400);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <strong>BridgeSplat</strong>
        </div>

        <nav className="topnav" aria-label="Primary">
          <button>
            Solutions <ChevronDown size={13} />
          </button>
          <button>
            Products <ChevronDown size={13} />
          </button>
          <button>
            Pricing <ChevronDown size={13} />
          </button>
          <button>
            Resources <ChevronDown size={13} />
          </button>
          <button>
            What&apos;s New <ChevronDown size={13} />
          </button>
        </nav>

        <div className="top-actions">
          <button className="icon-button" aria-label="Search inspections">
            <Search size={18} />
          </button>
          <button className="language-button">
            <Globe2 size={15} />
            EN
            <ChevronDown size={13} />
          </button>
          <button
            className="start-button"
            disabled={isProcessing}
            onClick={() => handleRun(file)}
          >
            {isProcessing ? "Processing" : "Start Scan"}
          </button>
          <button className="text-button">Contact</button>
          <button className="text-button">Sign In</button>
        </div>
      </header>

      <section className="hero-strip">
        <p>
          Discover structural insights and maintenance priorities around every span
          with BridgeSplat 3D digital twins.
        </p>
      </section>

      <aside className="left-panel">
        <section className="mission-strip">
          <span>Digital twin</span>
          <strong>{result.assetName}</strong>
          <small>
            {result.issues.length} mapped issue{result.issues.length === 1 ? "" : "s"} -
            {" "}
            {result.model.sourceFrames} source view
            {result.model.sourceFrames === 1 ? "" : "s"}
          </small>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Camera size={18} />
            <span>Inspection Media</span>
          </div>

          <label
            className={`upload-zone ${isDragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud size={28} />
            <strong>{file ? file.name : "Drop drone or phone footage"}</strong>
            <span>{file ? formatBytes(file.size) : "Supports images and videos"}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <div className="button-row">
            <button
              className="primary-button"
              disabled={isProcessing}
              onClick={() => handleRun(file)}
            >
              <Play size={17} />
              {isProcessing ? "Processing" : file ? "Run Scan" : "Run Demo"}
            </button>
            <button
              className="ghost-button"
              disabled={isProcessing}
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
                void handleRun(null);
              }}
            >
              Demo scan
            </button>
          </div>
          <p className="calibration-note">
            Uploaded media uses a prototype browser vision pass. The demo scan shows the intended product experience.
          </p>
        </section>

        <section className="panel-section">
          <div className="section-title">
            <Activity size={18} />
            <span>Processing Pipeline</span>
          </div>
          <div className="stage-list">
            {stages.map((stage) => (
              <div className={`stage-row ${stage.state}`} key={stage.stage}>
                <div className="stage-dot">
                  {stage.state === "complete" ? <CheckCircle2 size={16} /> : null}
                </div>
                <div>
                  <strong>{stage.label}</strong>
                  <span>{stage.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-section compact">
          <div className="section-title">
            <Leaf size={18} />
            <span>Sustainability Logic</span>
          </div>
          <p>{result.carbonNote}</p>
        </section>
      </aside>

      <section className="scene-panel" aria-label="Interactive bridge model">
        <BridgeScene
          issues={result.issues}
          selectedIssueId={selectedIssue?.id ?? null}
          onSelectIssue={setSelectedIssueId}
        />
      </section>

      <aside className="right-panel">
        <section className="score-section">
          <div className="score-header">
            <div>
              <span className="eyebrow">
                {isUploadedResult ? "Condition Preview" : "Bridge Health Score"}
              </span>
              <h2>{result.assetName}</h2>
            </div>
            <span className={`risk-badge ${result.riskLevel}`}>{result.riskLevel}</span>
          </div>

          <div className="score-body">
            <div
              className="score-ring"
              style={{
                background: `conic-gradient(${scoreColor(result.riskLevel)} ${result.healthScore * 3.6}deg, #e1e7dc 0deg)`,
              }}
            >
              <div>
                <strong>{result.healthScore}</strong>
                <span>/100</span>
              </div>
            </div>
            <div className="score-copy">
              <p>{result.summary}</p>
              <small>
                Input: {result.inputName} - {result.model.sourceFrames} source view
                {result.model.sourceFrames === 1 ? "" : "s"}
              </small>
            </div>
          </div>
          {isUploadedResult ? (
            <div className="method-note">
              Preview score. Needs trained model calibration before engineering use.
            </div>
          ) : null}
        </section>

        <section className="panel-section findings">
          <div className="section-title spread">
            <span>
              <ClipboardList size={18} />
              Priority Findings
            </span>
            <span>{result.issues.length}</span>
          </div>
          <div className="issue-list">
            {result.issues.map((issue) => (
              <button
                className={`issue-row ${issue.id === selectedIssue?.id ? "selected" : ""}`}
                key={issue.id}
                onClick={() => setSelectedIssueId(issue.id)}
              >
                <span
                  className="issue-type-dot"
                  style={{ backgroundColor: issueStyles[issue.type].color }}
                />
                <span>
                  <strong>{issue.title}</strong>
                  <small>
                    {issue.component} - {Math.round(issue.confidence * 100)}% confidence
                  </small>
                </span>
                <em className={`severity ${issue.severity}`}>{issue.severity}</em>
              </button>
            ))}
          </div>
        </section>

        {selectedIssue ? (
          <SelectedIssueCard issue={selectedIssue} />
        ) : (
          <section className="detail-card">
            <ShieldCheck size={20} />
            <h3>No issues selected</h3>
            <p>Run a scan or choose a marker in the 3D view.</p>
          </section>
        )}

        <section className="panel-section report-actions">
          <div className="section-title">
            <FileDown size={18} />
            <span>Report</span>
          </div>
          <p>{result.recommendation}</p>
          <div className="button-row">
            <button className="primary-button" onClick={() => downloadReport(result)}>
              <FileDown size={17} />
              Export MD
            </button>
            <button className="ghost-button" onClick={handleCopyReport}>
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy"}
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}

function SelectedIssueCard({ issue }: { issue: DamageIssue }) {
  const style = issueStyles[issue.type];

  return (
    <section className="detail-card">
      <div className="detail-heading">
        <span style={{ backgroundColor: style.soft, color: style.color }}>
          {style.label}
        </span>
        <em className={`severity ${issue.severity}`}>{issue.severity}</em>
      </div>
      <h3>{issue.title}</h3>
      <p>{issue.summary}</p>
      <dl className="metric-grid">
        <div>
          <dt>Component</dt>
          <dd>{issue.component}</dd>
        </div>
        <div>
          <dt>Frame</dt>
          <dd>{issue.frameReference}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>{issue.areaSqFt} sq ft</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{issue.priority}</dd>
        </div>
      </dl>
      <div className="location-line">
        <MapPin size={16} />
        x {issue.position.x}, y {issue.position.y}, z {issue.position.z}
      </div>
      <div className="recommendation">
        <AlertTriangle size={17} />
        <span>{issue.recommendation}</span>
      </div>
    </section>
  );
}

function scoreColor(risk: IssueSeverity) {
  if (severityRank[risk] >= 4) return "#bf263a";
  if (severityRank[risk] === 3) return "#ff315f";
  if (severityRank[risk] === 2) return "#bf6a16";
  return "#008c95";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
