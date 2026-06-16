import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { Reveal } from "../components/Reveal";
import { SectionLink } from "../components/SectionLink";
import { FeatureMock, HeroMockup } from "../components/landing/HeroMockup";
import { TrustCarousel } from "../components/landing/TrustCarousel";
import { HeroVideo } from "../components/landing/HeroVideo";
import { useAuth } from "../context/AuthContext";

const faqs = [
  {
    q: "Who is Verdant built for?",
    a: "Public works, DOT, and watershed teams in Atlanta who maintain bridges, parking decks, roads, and concrete structures. Inspectors upload field photos or drone stills; supervisors get prioritized findings with cost and sustainability context, without replacing your existing GIS or asset workflows.",
  },
  {
    q: "What problem does catching damage early actually solve?",
    a: "Most agencies discover deterioration late, when a localized crack has already forced a full deck replacement, emergency lane closures, or budget overruns. Verdant surfaces defects while repair is still feasible, so teams can schedule maintenance instead of reacting to failures.",
  },
  {
    q: "What types of infrastructure can Verdant inspect?",
    a: "Bridges, parking structures, roadways, retaining walls, and other visible concrete or steel surfaces. Upload bulk photos from on site inspections or drone captures. Verdant processes the full batch and maps findings back to each structure.",
  },
  {
    q: "What damage types does the CV model detect?",
    a: "Cracks, corrosion, spalling, and water damage. Every detection includes a confidence score, severity rating, and a recommended repair path, so reviewers can focus on urgent items instead of scrolling through hundreds of images manually.",
  },
  {
    q: "How is this different from a standard inspection workflow?",
    a: "Traditional inspections produce photos and handwritten notes; prioritization happens later in a spreadsheet. Verdant runs computer vision on every image at upload, ranks defects by severity, and attaches repair cost ranges and embodied carbon estimates. That turns raw field data into an actionable maintenance queue.",
  },
  {
    q: "How does Verdant estimate sustainability impact?",
    a: "For each finding we compare localized repair material use against a delayed full replacement scenario. That gives your team a CO₂e estimate for acting now versus deferring, which helps when justifying repair budgets to sustainability and capital planning stakeholders.",
  },
  {
    q: "Can we integrate with our existing GIS or asset systems?",
    a: "Yes. Verdant is designed to sit alongside tools you already use, including ArcGIS, Cityworks, DJI FlightHub, Slack, and Power BI. Export inspection reports and findings without ripping out your current asset registry or field data pipeline.",
  },
  {
    q: "What does a typical inspection look like in the product?",
    a: "Sign in, select a structure, and upload your photo set. Verdant runs detection, then displays clickable hotspots on each image with severity, repair window, and cost range. Supervisors can filter by damage type, export a report, and share findings with the team. The demo above walks through the full flow.",
  },
];

const tryVerdantHighlights = [
  "Run a full inspection on sample bridge photos",
  "Explore severity scores and repair recommendations",
  "See sustainability impact estimates per finding",
  "No setup required. Sign in and start reviewing",
];

function Btn({
  children,
  to,
  variant = "primary",
  large = false,
  onClick,
}: {
  children: ReactNode;
  to?: string;
  variant?: "primary" | "ghost" | "outline" | "white";
  large?: boolean;
  onClick?: () => void;
}) {
  const cls = `v-btn v-btn-${variant}${large ? " v-btn-lg" : ""}`;
  return to ? (
    <Link className={cls} to={to} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <button className={cls} type="button">
      {children}
    </button>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`v-faq-item${open ? " open" : ""}`}>
      <button
        className="v-faq-q"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {q}
        <ChevronDown size={18} />
      </button>
      <div className="v-faq-a-wrap">
        <p className="v-faq-a">{a}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { signOut } = useAuth();
  const openAuth = () => signOut();

  return (
    <div className="v-site">
      {/* Cinematic video hero */}
      <section className="v-hero-cinematic">
        <HeroVideo />

        <header className="v-nav-cinematic">
          <div className="v-nav-cinematic-left">
            <Logo light />
          </div>
          <nav className="v-nav-pill" aria-label="Main">
            <SectionLink href="#features">Features</SectionLink>
            <SectionLink href="#faq">FAQ</SectionLink>
            <SectionLink href="#demo">Demo</SectionLink>
          </nav>
          <div className="v-nav-cinematic-actions">
            <Link className="v-btn v-btn-outline" to="/auth" onClick={openAuth}>
              Log in
            </Link>
            <Link className="v-btn v-btn-white" to="/auth?mode=signup" onClick={openAuth}>
              Get started
            </Link>
          </div>
        </header>

        <div className="v-hero-cinematic-inner">
          <h1>
            Inspect infrastructure
            <br />
            <em>before</em> it becomes a full replacement.
          </h1>
          <div className="v-hero-cinematic-actions">
            <Btn large variant="outline" to="/auth?mode=signup" onClick={openAuth}>
              Start inspecting <ArrowRight size={16} />
            </Btn>
          </div>
        </div>
      </section>

      {/* Dashboard preview + trust strip */}
      <section className="v-hero-below" id="demo">
        <div className="v-container v-demo-stage">
          <Reveal variant="up">
            <HeroMockup />
          </Reveal>
        </div>
        <Reveal delay={120}>
          <div className="v-trust-strip">
            <div className="v-container">
              <p>Built to support Atlanta agencies maintaining critical infrastructure</p>
              <TrustCarousel />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Zigzag feature 1 */}
      <section className="v-section v-section-earth v-zigzag" id="features">
        <div className="v-container v-zigzag-row">
          <Reveal variant="left">
            <div className="v-zigzag-copy">
              <span className="v-eyebrow">Computer vision</span>
              <h2>Optimal defect detection for every surface</h2>
              <p>
                Our YOLOv8 model flags cracks, corrosion, spalling, and water damage with
                confidence scores on every image, so inspectors spend less time reviewing and
                more time acting.
              </p>
              <ul className="v-check-list">
                <li>
                  <Check size={16} /> 4 damage types with confidence scores
                </li>
                <li>
                  <Check size={16} /> Bulk photo & drone still upload
                </li>
                <li>
                  <Check size={16} /> Clickable hotspots on every finding
                </li>
              </ul>
            </div>
          </Reveal>
          <Reveal variant="right" delay={100}>
            <FeatureMock variant="detect" />
          </Reveal>
        </div>
      </section>

      {/* Zigzag feature 2 — flipped */}
      <section className="v-section v-section-light v-zigzag">
        <div className="v-container v-zigzag-row reverse">
          <Reveal variant="right">
            <div className="v-zigzag-copy">
              <span className="v-eyebrow">Repair intelligence</span>
              <h2>Prioritized recommendations with real cost data</h2>
              <p>
                Each defect becomes a clickable repair path with severity, timeframe, and cost
                range, plus quantified sustainability impact so your team can justify repairing now
                over replacing later.
              </p>
              <ul className="v-check-list">
                <li>
                  <Check size={16} /> Severity scoring & repair windows
                </li>
                <li>
                  <Check size={16} /> $4k to $12k repair vs $28k to $48k replace
                </li>
                <li>
                  <Check size={16} /> Embodied carbon per recommendation
                </li>
              </ul>
            </div>
          </Reveal>
          <Reveal variant="left" delay={100}>
            <FeatureMock variant="repair" />
          </Reveal>
        </div>
      </section>

      {/* Try Verdant CTA */}
      <section className="v-section v-section-earth v-pricing" id="get-started">
        <div className="v-container v-pricing-inner">
          <Reveal variant="left">
            <div className="v-pricing-copy">
              <span className="v-eyebrow v-eyebrow-light">Try Verdant</span>
              <h2>See how early repair intelligence works on real infrastructure</h2>
              <p>
                Sign in to run an inspection yourself, or scroll up to the demo to preview the
                full workflow, from photo upload through defect detection, repair priorities, and
                sustainability impact.
              </p>
            </div>
          </Reveal>
          <Reveal variant="right" delay={100}>
            <div className="v-pricing-card">
              <div className="v-pricing-card-body">
                <ul className="v-check-list v-pricing-checklist">
                  {tryVerdantHighlights.map((item) => (
                    <li key={item}>
                      <Check size={16} /> {item}
                    </li>
                  ))}
                </ul>
                <div className="v-pricing-cta-actions">
                  <Btn to="/auth" variant="primary" large onClick={openAuth}>
                    Sign in <ArrowRight size={16} />
                  </Btn>
                  <SectionLink href="#demo" className="v-btn v-btn-outline v-btn-lg">
                    View demo
                  </SectionLink>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="v-section v-section-light" id="faq">
        <div className="v-container v-faq-wrap">
          <Reveal variant="up">
            <div className="v-faq-head">
              <h2>Frequently Asked Questions</h2>
              <p>Everything you need to know about Verdant for municipal infrastructure teams.</p>
            </div>
          </Reveal>
          <Reveal variant="up" delay={80}>
            <div className="v-faq-list">
              {faqs.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="v-footer">
        <div className="v-container v-footer-inner">
          <div className="v-footer-brand">
            <Logo light />
            <p>Early infrastructure repair intelligence for sustainable cities.</p>
          </div>
          <div className="v-footer-cols">
            <div>
              <strong>Product</strong>
              <SectionLink href="#features">Features</SectionLink>
              <SectionLink href="#get-started">Try Verdant</SectionLink>
              <Link to="/dashboard">Dashboard</Link>
            </div>
            <div>
              <strong>Company</strong>
              <Link to="/auth" onClick={openAuth}>Log in</Link>
              <Link to="/auth?mode=signup" onClick={openAuth}>Sign up</Link>
              <SectionLink href="#faq">FAQ</SectionLink>
            </div>
            <div>
              <strong>Legal</strong>
              <a href="#privacy">Privacy</a>
              <a href="#terms">Terms</a>
            </div>
          </div>
          <span className="v-footer-copy">© 2026 Verdant</span>
        </div>
      </footer>
    </div>
  );
}
