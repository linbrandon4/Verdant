import { type ReactNode } from "react";
import { ArrowLeft, ExternalLink, ImageIcon } from "lucide-react";
import type { InspectionResult } from "../../types";

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="insp-section">
      <div className="insp-section-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null | undefined }) {
  const empty = value == null || value === "";
  return (
    <div className="insp-metric">
      <span className="insp-metric-label">{label}</span>
      <strong className={`insp-metric-value${empty ? " is-empty" : ""}`}>{displayValue(value)}</strong>
    </div>
  );
}

type InspectionResultsProps = {
  projectName: string;
  result: InspectionResult;
  onBack: () => void;
};

export function InspectionResults({ projectName, result, onBack }: InspectionResultsProps) {
  const businesses = result.localBusinesses ?? [];
  const boxes = result.detectionBoxes ?? [];

  return (
    <div className="insp-results">
      <header className="insp-results-head">
        <button className="insp-back-btn" onClick={onBack} type="button">
          <ArrowLeft size={16} />
          Back to form
        </button>
        <div>
          <h1>{projectName || "Inspection results"}</h1>
          <p>
            {result.detections != null
              ? `${result.detections} detections · review findings below`
              : "Review findings below"}
          </p>
        </div>
      </header>

      <Section title="Annotated image" subtitle="Detection overlay from backend">
        <div className="insp-image-panel">
          <div className="insp-image-frame">
            {result.annotatedImageUrl ? (
              <img alt="Annotated inspection" src={result.annotatedImageUrl} />
            ) : (
              <div className="insp-image-empty">
                <ImageIcon size={28} strokeWidth={1.5} />
                <span>Annotated image from backend</span>
              </div>
            )}
            {boxes.map((box) => (
              <div
                className="insp-detection-box"
                key={box.id}
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                }}
              >
                <span>{box.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Summary" subtitle="Key metrics from backend">
        <div className="insp-metrics-panel">
          <Metric label="Detections" value={result.detections} />
          <Metric label="Severity" value={result.severity} />
          <Metric label="Cost to fix" value={result.costToFix} />
          <Metric label="Timeline to fix" value={result.timelineToFix} />
        </div>
      </Section>

      <Section title="Repair guidance" subtitle="Sustainability and impact from backend">
        <div className="insp-guidance-grid">
          <article className="insp-text-block">
            <h3>Sustainable fix</h3>
            <p className={result.sustainableFix ? "" : "is-empty"}>
              {displayValue(result.sustainableFix)}
            </p>
          </article>
          <article className="insp-text-block">
            <h3>Traditional vs sustainable</h3>
            <p className={result.traditionalComparison ? "" : "is-empty"}>
              {displayValue(result.traditionalComparison)}
            </p>
          </article>
          <article className="insp-text-block insp-text-block-wide">
            <h3>Estimated impact</h3>
            <p className={result.estimatedImpact ? "" : "is-empty"}>
              {displayValue(result.estimatedImpact)}
            </p>
          </article>
        </div>
      </Section>

      <Section title="Local businesses" subtitle="Contractor links from backend">
        <div className="insp-businesses-panel">
          {businesses.length > 0 ? (
            <ul className="insp-business-list">
              {businesses.map((biz) => (
                <li key={biz.url + biz.name}>
                  <a href={biz.url} rel="noreferrer" target="_blank">
                    {biz.name}
                    <ExternalLink size={13} />
                  </a>
                  {biz.source ? <small>{biz.source}</small> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="is-empty">Local business links from backend</p>
          )}
        </div>
      </Section>
    </div>
  );
}
