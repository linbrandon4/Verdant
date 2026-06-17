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
import {
  assetTypeToInspectionType,
  inspectImages,
  InspectionApiError,
} from "../api/inspection";
import { Logo } from "../components/Logo";
import { InspectionResults } from "../components/dashboard/InspectionResults";
import { useAuth } from "../context/AuthContext";
import type { AssetType, SavedAnalysis, SourceFile } from "../types";
import { parseLocationLabel } from "../utils/location";

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

function formatAnalysisDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function assetLabel(assetType: AssetType) {
  return assetOptions.find((option) => option.value === assetType)?.label ?? assetType;
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
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedId, setSelectedId] = useState<"new" | string>("new");
  const [projectName, setProjectName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("bridge");
  const [locationLabel, setLocationLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const selectedAnalysis = analyses.find((analysis) => analysis.id === selectedId);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const resetDraft = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    fileMapRef.current.clear();
    setFiles([]);
    setProjectName("");
    setAssetType("bridge");
    setLocationLabel("");
    setNotes("");
    setAnalyzeError(null);
  };

  const handleNewAnalysis = () => {
    resetDraft();
    setSelectedId("new");
  };

  const handleFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) return;

    const newFiles: SourceFile[] = incoming.map((file, index) => {
      const id = `file-${Date.now()}-${index}`;
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(previewUrl);
      fileMapRef.current.set(id, file);
      return {
        id,
        fileName: file.name,
        fileType: file.type,
        previewUrl,
        uploadedAt: new Date().toISOString(),
      };
    });

    if (selectedId !== "new") {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = newFiles.map((file) => file.previewUrl);
      fileMapRef.current.clear();
      incoming.forEach((file, index) => {
        fileMapRef.current.set(newFiles[index].id, file);
      });
      setProjectName("");
      setAssetType("bridge");
      setLocationLabel("");
      setNotes("");
      setSelectedId("new");
      setFiles(newFiles);
    } else {
      setFiles((prev) => [...prev, ...newFiles]);
    }

    setAnalyzeError(null);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current = objectUrlsRef.current.filter((u) => u !== removed.previewUrl);
        fileMapRef.current.delete(id);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearAll = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    fileMapRef.current.clear();
    setFiles([]);
    setAnalyzeError(null);
  };

  const canAnalyze = files.length > 0 && projectName.trim().length > 0;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    const uploadFiles = files
      .map((entry) => fileMapRef.current.get(entry.id))
      .filter((file): file is File => Boolean(file));

    if (uploadFiles.length === 0) {
      setAnalyzeError("Could not read the selected photos. Try uploading again.");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeError(null);
    setAnalyzeProgress(null);

    try {
      const { city, state } = parseLocationLabel(locationLabel);
      const result = await inspectImages({
        files: uploadFiles,
        inspectionType: assetTypeToInspectionType(assetType),
        city,
        state,
        onProgress: setAnalyzeProgress,
      });

      const saved: SavedAnalysis = {
        id: `analysis-${Date.now()}`,
        name: projectName.trim(),
        assetType,
        locationLabel,
        notes,
        result,
        createdAt: new Date().toISOString(),
      };

      setAnalyses((prev) => [saved, ...prev]);
      setSelectedId(saved.id);
      clearAll();
      setProjectName("");
      setLocationLabel("");
      setNotes("");
    } catch (error) {
      const message =
        error instanceof InspectionApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Analysis failed. Check that the backend is running.";
      setAnalyzeError(message);
    } finally {
      setIsAnalyzing(false);
      setAnalyzeProgress(null);
    }
  };

  const handleDeleteAnalysis = (id: string) => {
    setAnalyses((prev) => prev.filter((analysis) => analysis.id !== id));
    if (selectedId === id) {
      handleNewAnalysis();
    }
  };

  const handleSelectAnalysis = (id: string) => {
    setSelectedId(id);
  };

  const handleGoHome = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    signOut();
    navigate("/", { replace: true });
  };

  const activeResult = selectedAnalysis?.result ?? null;
  const activeProjectName = selectedAnalysis?.name ?? projectName;
  const showResults = selectedId !== "new" && Boolean(activeResult);
  const showNewForm = selectedId === "new";

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
            <button onClick={handleNewAnalysis} type="button">
              + New
            </button>
          </div>

          <button
            className={`app-dash-list-item ${selectedId === "new" ? "selected" : ""}`}
            onClick={handleNewAnalysis}
            type="button"
          >
            <div>
              <strong>New inspection</strong>
              <small>Upload photos to begin</small>
            </div>
          </button>

          {analyses.map((analysis) => (
            <button
              className={`app-dash-list-item ${selectedId === analysis.id ? "selected" : ""}`}
              key={analysis.id}
              onClick={() => handleSelectAnalysis(analysis.id)}
              type="button"
            >
              <div>
                <strong>{analysis.name}</strong>
                <small>
                  {assetLabel(analysis.assetType)} · {analysis.result.detections ?? 0} findings ·{" "}
                  {analysis.result.priority ?? "Low"} · {formatAnalysisDate(analysis.createdAt)}
                </small>
              </div>
            </button>
          ))}
        </div>

        <div className={`app-dash-detail${isAnalyzing ? " is-loading" : ""}`}>
          {isAnalyzing ? (
            <div className="insp-loading">
              <div className="insp-loading-pulse" />
              <p>
                {analyzeProgress
                  ? `Analyzing photo ${analyzeProgress.current} of ${analyzeProgress.total}: ${analyzeProgress.fileName}`
                  : "Running inspection analysis…"}
              </p>
              <p className="insp-loading-hint">YOLO detection + AI report — usually 20–45 sec per photo</p>
            </div>
          ) : null}

          {showResults && activeResult ? (
            <InspectionResults
              onDelete={() => handleDeleteAnalysis(selectedId)}
              projectName={activeProjectName}
              result={activeResult}
            />
          ) : showNewForm ? (
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
                      placeholder="Atlanta, GA"
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
                  {analyzeError ? <p className="dash-error">{analyzeError}</p> : null}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
