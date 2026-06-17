import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Cloud,
  ExternalLink,
  ImageIcon,
  Info,
  Leaf,
  MapPin,
  Phone,
  Star,
  Trash2,
  TreePine,
  Wrench,
} from "lucide-react";
import type { DetectionDetail, ImageInspectionResult, InspectionResult } from "../../types";

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function parseImpactLevel(
  impact: string | null | undefined,
  key: "Material waste avoided" | "Carbon savings",
): string | null {
  if (!impact) return null;
  const match = impact.match(new RegExp(`${key}:\\s*(Low|Medium|High)`, "i"));
  return match?.[1] ?? null;
}

function parseImpactAnalogy(impact: string | null | undefined): string | null {
  if (!impact) return null;
  const lines = impact.split("\n\n").map((line) => line.trim());
  const analogy = lines.find(
    (line) =>
      !line.startsWith("Material waste") &&
      !line.startsWith("Carbon savings") &&
      line.length > 0,
  );
  return analogy ?? null;
}

function statusHeadline(detections: number | null | undefined, priority: string | null | undefined) {
  if (!detections || detections === 0) return "No Significant Damage Detected";
  if (priority === "Critical" || priority === "High") return "Significant Damage Detected";
  return "Damage Detected";
}

function statusTone(detections: number | null | undefined, priority: string | null | undefined) {
  if (!detections || detections === 0) return "good";
  if (priority === "Critical" || priority === "High") return "critical";
  if (priority === "Medium") return "warn";
  return "good";
}

function DetectionList({ items }: { items: DetectionDetail[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="insp-detection-list">
      {items.map((item, index) => (
        <li key={`${item.damageType}-${index}`}>
          <span className="insp-detection-type">{item.damageType.replace(/_/g, " ")}</span>
          <span className="insp-detection-meta">
            {item.severityHint} severity
          </span>
        </li>
      ))}
    </ul>
  );
}

function ImagePanel({ image }: { image: ImageInspectionResult }) {
  const details = image.detectionDetails ?? [];

  return (
    <article className="insp-image-card">
      <div className="insp-image-card-head">
        <strong>{image.fileName}</strong>
        <span>
          {image.detections != null ? `${image.detections} detections` : "—"}
          {image.priority ? ` · ${image.priority} priority` : ""}
        </span>
      </div>
      <div className="insp-image-frame">
        {image.annotatedImageUrl ? (
          <img alt={`Annotated ${image.fileName}`} src={image.annotatedImageUrl} />
        ) : (
          <div className="insp-image-empty">
            <ImageIcon size={28} strokeWidth={1.5} />
            <span>No annotated image returned</span>
          </div>
        )}
      </div>
      {details.length > 0 ? (
        <div className="insp-image-detections">
          <DetectionList items={details} />
        </div>
      ) : null}
    </article>
  );
}

type InspectionResultsProps = {
  projectName: string;
  result: InspectionResult;
  onBack?: () => void;
  onDelete?: () => void;
};

export function InspectionResults({ projectName, result, onBack, onDelete }: InspectionResultsProps) {
  const businesses = result.localBusinesses ?? [];
  const images = result.images?.length
    ? result.images
    : result.annotatedImageUrl
      ? [
          {
            fileName: "Inspection photo",
            annotatedImageUrl: result.annotatedImageUrl,
            detections: result.detections,
            severity: result.severity,
            priority: result.priority,
            inspectionType: result.inspectionType,
            detectionDetails: result.detectionDetails,
            detectionBoxes: result.detectionBoxes,
          },
        ]
      : [];
  const photoCount = images.length;
  const assessmentTitle = result.inspectionType
    ? `${result.inspectionType} Assessment`
    : projectName
      ? `${projectName} Assessment`
      : "Inspection Assessment";

  const tone = statusTone(result.detections, result.priority);
  const materialWaste = parseImpactLevel(result.estimatedImpact, "Material waste avoided");
  const carbonSavings = parseImpactLevel(result.estimatedImpact, "Carbon savings");
  const impactAnalogy = parseImpactAnalogy(result.estimatedImpact);
  const infoMessage =
    result.sustainabilityComparison || result.disclaimer || result.summary || null;

  const sustainableBenefits = ["Lower material waste", "Lower emissions", "Lower cost"];

  return (
    <div className="insp-results insp-results-v2">
      <header className="insp-results-head">
        <div className="insp-results-head-main">
          {onBack ? (
            <button className="insp-back-btn" onClick={onBack} type="button">
              <ArrowLeft size={16} />
              Back to form
            </button>
          ) : null}
          <h1>{assessmentTitle}</h1>
        </div>
        {onDelete ? (
          <button
            aria-label="Delete analysis"
            className="insp-delete-btn"
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        ) : null}
      </header>

      <div className={`insp-status-banner insp-status-banner-${tone}`}>
        <div className="insp-status-banner-icon" aria-hidden="true">
          {tone === "good" ? <CheckCircle2 size={28} strokeWidth={2} /> : <AlertTriangle size={28} strokeWidth={2} />}
        </div>
        <div className="insp-status-banner-body">
          <strong>{statusHeadline(result.detections, result.priority)}</strong>
          <div className="insp-status-banner-meta">
            <div>
              <span>Priority</span>
              <strong>{displayValue(result.priority ?? "Low")}</strong>
            </div>
            <div>
              <span>Recommended action</span>
              <strong>{displayValue(result.timelineToFix ?? "Reinspect in 60–90 days")}</strong>
            </div>
          </div>
        </div>
      </div>

      {images.length > 0 ? (
        <section className="insp-block">
          <h2 className="insp-block-title">
            {photoCount > 1 ? "Annotated images" : "Annotated image"}
          </h2>
          <div className={`insp-image-panel${photoCount > 1 ? " is-grid" : ""}`}>
            {images.map((image, index) => (
              <ImagePanel image={image} key={`${image.fileName}-${index}`} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="insp-block">
        <h2 className="insp-block-title">Recommended approach</h2>
        <div className="insp-approach-grid">
          <article className="insp-approach-card insp-approach-card-sustainable">
            <div className="insp-approach-card-head">
              <span className="insp-approach-icon" aria-hidden="true">
                <Leaf size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3>Sustainable option</h3>
                <span className="insp-recommended-badge">Recommended</span>
              </div>
            </div>
            <div className="insp-approach-card-body">
              <p>{displayValue(result.sustainableFix)}</p>
              <div className="insp-benefits">
                <strong>Benefits</strong>
                <ul>
                  {sustainableBenefits.map((benefit) => (
                    <li key={benefit}>
                      <Check size={14} strokeWidth={2.5} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="insp-approach-cost">
              <span>Estimated cost</span>
              <strong>{displayValue(result.sustainableCost ?? "—")}</strong>
            </p>
          </article>

          <article className="insp-approach-card insp-approach-card-traditional">
            <div className="insp-approach-card-head">
              <span className="insp-approach-icon insp-approach-icon-muted" aria-hidden="true">
                <Wrench size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3>Traditional option</h3>
              </div>
            </div>
            <div className="insp-approach-card-body">
              <p>{displayValue(result.traditionalSolution)}</p>
            </div>
            <p className="insp-approach-cost">
              <span>Estimated cost</span>
              <strong>{displayValue(result.traditionalCost ?? "—")}</strong>
            </p>
          </article>
        </div>
      </section>

      <section className="insp-block">
        <h2 className="insp-block-title">Environmental impact</h2>
        <div className="insp-impact-card">
          <div className="insp-impact-metrics">
            <div className="insp-impact-metric">
              <span className="insp-impact-icon" aria-hidden="true">
                <Leaf size={20} strokeWidth={1.75} />
              </span>
              <div>
                <span>Material waste avoided</span>
                <strong>{displayValue(materialWaste ?? "Low")}</strong>
              </div>
            </div>
            <div className="insp-impact-metric">
              <span className="insp-impact-icon" aria-hidden="true">
                <Cloud size={20} strokeWidth={1.75} />
              </span>
              <div>
                <span>Carbon savings</span>
                <strong>{displayValue(carbonSavings ?? "Low")}</strong>
              </div>
            </div>
          </div>
          {impactAnalogy ? (
            <p className="insp-impact-note">
              <TreePine size={16} strokeWidth={1.75} />
              {impactAnalogy}
            </p>
          ) : null}
        </div>
      </section>

      {businesses.length > 0 ? (
        <section className="insp-block">
          <h2 className="insp-block-title">Local businesses</h2>
          <div className="insp-business-grid">
            {businesses.map((biz) => (
              <article className="insp-business-card" key={biz.url + biz.name}>
                <div className="insp-business-card-top">
                  <div>
                    <h3>{biz.name}</h3>
                    {biz.specialty ? <p>{biz.specialty}</p> : null}
                  </div>
                  {biz.rating != null ? (
                    <span className="insp-business-rating">
                      <Star size={14} fill="currentColor" strokeWidth={0} />
                      {biz.rating}
                      {biz.ratingCount != null ? (
                        <small>({biz.ratingCount})</small>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <div className="insp-business-meta">
                  {biz.address ? (
                    <span>
                      <MapPin size={14} strokeWidth={1.75} />
                      {biz.address}
                    </span>
                  ) : null}
                  {biz.phone ? (
                    <span>
                      <Phone size={14} strokeWidth={1.75} />
                      {biz.phone}
                    </span>
                  ) : null}
                </div>
                {biz.url && biz.url !== "#" ? (
                  <a
                    className="insp-business-link"
                    href={biz.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View business
                    <ExternalLink size={13} />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {infoMessage ? (
        <div className="insp-info-banner">
          <Info size={18} strokeWidth={1.75} />
          <p>{infoMessage}</p>
        </div>
      ) : null}
    </div>
  );
}
