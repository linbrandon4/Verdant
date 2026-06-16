import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Camera,
  ClipboardList,
  FileText,
  ImagePlus,
  LogOut,
  MapPin,
  Milestone,
  Play,
  Settings,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { InspectionResults } from "../components/dashboard/InspectionResults";
import { useAuth } from "../context/AuthContext";
import type { AssetType, InspectionResult, SourceFile } from "../types";
import { createEmptyInspectionResult } from "../types";

const assetOptions: Array<{ value: AssetType; label: string }> = [
  { value: "bridge", label: "Bridge" },
  { value: "parking_deck", label: "Parking deck" },
  { value: "road", label: "Road" },
  { value: "building", label: "Building" },
  { value: "retaining_wall", label: "Retaining wall" },
  { value: "other_concrete", label: "Other concrete" },
];

const navItems: Array<{
  label: string;
  icon: typeof ClipboardList;
  active?: boolean;
}> = [
  { label: "Inspections", icon: ClipboardList, active: true },
  { label: "Settings", icon: Settings },
];

const queue: Array<{
  id: string;
  name: string;
  asset: string;
  status: string;
  findings: number;
  date: string;
}> = [];

function StatusBadge({ level }: { level: string }) {
  const cls =
    level === "Critical"
      ? "badge-critical"
      : level === "High"
        ? "badge-high"
        : level === "Medium"
          ? "badge-medium"
          : "badge-low";
  return <span className={`ui-badge ${cls}`}>{level}</span>;
}

function DashField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="dash-field">
      <span className="dash-field-label">{label}</span>
      <div className="dash-input-wrap">
        <span className="dash-field-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

export default function DashboardPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState("new");
  const [projectName, setProjectName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("bridge");
  const [locationLabel, setLocationLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const handleFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;

    const newFiles: SourceFile[] = incoming.map((file, index) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);
      return {
        id: `file-${Date.now()}-${index}`,
        fileName: file.name,
        fileType: file.type,
        previewUrl,
        uploadedAt: new Date().toISOString(),
      };
    });

    setFiles((prev) => [...prev, ...newFiles]);
    setSelectedId("new");
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== removed.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAll = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setFiles([]);
  };

  const canAnalyze = files.length > 0 && projectName.trim().length > 0;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    await new Promise((r) => setTimeout(r, 1200));
    setInspectionResult(createEmptyInspectionResult());
    setIsAnalyzing(false);
  };

  const handleBackToForm = () => {
    setInspectionResult(null);
  };

  const selected = queue.find((q) => q.id === selectedId);

  const handleGoHome = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="app-dashboard">
      <aside className="app-dash-sidebar">
        <div className="app-dash-sidebar-top">
          <Logo to="/" onClick={handleGoHome} />
          <nav>
            {navItems.map(({ label, icon: Icon, active }) => (
              <a className={active ? "active" : ""} href="#" key={label}>
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </a>
            ))}
          </nav>
        </div>
        <button className="app-dash-signout" onClick={signOut} type="button">
          <LogOut size={16} strokeWidth={1.75} />
          Sign out
        </button>
      </aside>

      <div className="app-dash-panes">
        <div className="app-dash-list">
          <div className="app-dash-list-head">
            <strong>Structures</strong>
            <button onClick={() => { setInspectionResult(null); setSelectedId("new"); }} type="button">
              + New
            </button>
          </div>
          <button
            className={`app-dash-list-item ${selectedId === "new" ? "selected" : ""}`}
            onClick={() => { setInspectionResult(null); setSelectedId("new"); }}
            type="button"
          >
            <div>
              <strong>New inspection</strong>
              <small>Upload photos to begin</small>
            </div>
          </button>
          {queue.map((row) => (
            <button
              className={`app-dash-list-item ${selectedId === row.id ? "selected" : ""}`}
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              type="button"
            >
              <div>
                <strong>{row.name}</strong>
                <small>
                  {row.asset} · {row.findings} findings · {row.date}
                </small>
              </div>
              <StatusBadge level={row.status} />
            </button>
          ))}
        </div>

        <div className={`app-dash-detail${isAnalyzing ? " is-loading" : ""}`}>
          {isAnalyzing ? (
            <div className="insp-loading">
              <div className="insp-loading-pulse" />
              <p>Running inspection analysis…</p>
            </div>
          ) : null}

          {inspectionResult ? (
            <InspectionResults
              onBack={handleBackToForm}
              projectName={projectName}
              result={inspectionResult}
            />
          ) : selectedId === "new" ? (
            <>
              <div className="app-dash-form">
                <DashField icon={<Building2 size={16} />} label="Project name">
                  <input
                    placeholder="e.g. Overpass B104"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </DashField>

                <div className="app-dash-form-row">
                  <DashField icon={<Milestone size={16} />} label="Asset type">
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value as AssetType)}
                    >
                      {assetOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </DashField>
                  <DashField icon={<MapPin size={16} />} label="Location">
                    <input
                      placeholder="Downtown corridor"
                      value={locationLabel}
                      onChange={(e) => setLocationLabel(e.target.value)}
                    />
                  </DashField>
                </div>

                <DashField icon={<FileText size={16} />} label="Notes">
                  <textarea
                    placeholder="Drone orbit, visible staining near joints…"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </DashField>
              </div>

              <div className="app-dash-upload">
                <div className="app-dash-upload-head">
                  <span className="app-dash-upload-icon" aria-hidden="true">
                    <Camera size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <strong>Upload photos</strong>
                    <p>Add drone imagery or field photos for analysis.</p>
                  </div>
                  {files.length > 0 ? (
                    <button className="app-dash-clear" onClick={clearAll} type="button">
                      <Trash2 size={14} />
                      Clear
                    </button>
                  ) : null}
                </div>

                <label
                  className={`upload-zone ${isDragging ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFiles(e.dataTransfer.files);
                  }}
                >
                  <span className="upload-zone-icon" aria-hidden="true">
                    <UploadCloud size={28} strokeWidth={1.5} />
                  </span>
                  <span className="upload-zone-title">Drop photos here or click to browse</span>
                  <span className="upload-zone-hint">JPG, PNG, MP4 up to 2GB</span>
                  <input
                    ref={inputRef}
                    accept="image/*"
                    multiple
                    type="file"
                    onChange={(e) => {
                      if (e.target.files) handleFiles(e.target.files);
                    }}
                  />
                </label>

                {files.length > 0 ? (
                  <div className="file-grid">
                    {files.map((file) => (
                      <div className="file-thumb" key={file.id}>
                        <img alt={file.fileName} src={file.previewUrl} />
                        <div className="file-thumb-info">
                          <span>{file.fileName}</span>
                          <button
                            aria-label={`Remove ${file.fileName}`}
                            onClick={() => removeFile(file.id)}
                            type="button"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      className="file-add"
                      onClick={() => inputRef.current?.click()}
                      type="button"
                    >
                      <ImagePlus size={20} />
                    </button>
                  </div>
                ) : null}

                <div className="app-dash-actions">
                  <button
                    className="app-dash-analyze-btn"
                    disabled={!canAnalyze || isAnalyzing}
                    onClick={() => void handleAnalyze()}
                    type="button"
                  >
                    <Play size={16} fill="currentColor" />
                    {isAnalyzing ? "Preparing analysis…" : "Analyze photos"}
                  </button>
                  {!projectName.trim() && files.length > 0 ? (
                    <p className="dash-hint">Add a project name to continue.</p>
                  ) : null}
                </div>
              </div>
            </>
          ) : selected ? (
            <>
              <header className="app-dash-detail-head">
                <div className="app-dash-detail-title">
                  <span className="app-dash-detail-icon" aria-hidden="true">
                    <ClipboardList size={22} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h1>{selected.name}</h1>
                    <p>
                      {selected.asset} · {selected.findings} findings
                    </p>
                  </div>
                </div>
                <button className="app-dash-analyze-btn" type="button">
                  View report
                </button>
              </header>

              <div className="ui-detail-image app-dash-preview">
                <span className="ui-hotspot h1">Crack 94%</span>
                <span className="ui-hotspot h2">Water 87%</span>
                <span className="ui-hotspot h3">Spall 91%</span>
              </div>

              <div className="ui-recs app-dash-recs">
                <strong>Repair recommendations</strong>
                <div className="ui-rec">
                  <StatusBadge level="High" />
                  <div>
                    <span>Localized joint sealing</span>
                    <small>$4.2k to $8.1k · 30 to 90 days · 2.1t CO₂e avoided</small>
                  </div>
                </div>
                <div className="ui-rec">
                  <StatusBadge level="Medium" />
                  <div>
                    <span>Deck spalling patch</span>
                    <small>$1.8k to $3.4k · 90 to 180 days · 0.8t CO₂e avoided</small>
                  </div>
                </div>
              </div>

              <div className="ui-history app-dash-history">
                <strong>History</strong>
                <div className="ui-history-item">
                  <i />
                  <div>
                    <span>12 photos uploaded</span>
                    <small>{selected.date}, 2026</small>
                  </div>
                </div>
                <div className="ui-history-item">
                  <i />
                  <div>
                    <span>CV model flagged {selected.findings} defects</span>
                    <small>{selected.date}, 2026</small>
                  </div>
                </div>
                <div className="ui-history-item">
                  <i />
                  <div>
                    <span>Repair queue generated</span>
                    <small>{selected.date}, 2026</small>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
