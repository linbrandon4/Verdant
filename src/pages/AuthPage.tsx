import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthBrandVideo } from "../components/AuthBrandVideo";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (isLoading || user) {
    return (
      <div className="loading-screen">
        <div className="loading-pulse" />
      </div>
    );
  }

  const switchMode = (next: "signin" | "signup") => {
    if (next === mode) return;
    setError("");
    setMode(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
      navigate("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="v-auth">
      <section className="v-auth-brand">
        <AuthBrandVideo />
        <div className="v-auth-brand-overlay" aria-hidden="true" />
        <Logo light />
        <div className="v-auth-brand-copy">
          <span className="v-eyebrow v-eyebrow-light">Verdant</span>
          <h2>
            Inspect infrastructure
            <br />
            <em>before</em> it becomes a full replacement.
          </h2>
          <p>
            Upload field photos, detect damage early, and prioritize repairs with cost and
            sustainability context built for municipal teams.
          </p>
        </div>
      </section>

      <section className="v-auth-panel">
        <header className="v-auth-nav">
          <Logo />
          <Link className="v-auth-back" to="/">
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </header>

        <div className="v-auth-card">
          <div className="auth-tabs" data-active={mode}>
            <span className="auth-tabs-indicator" aria-hidden="true" />
            <button
              className={mode === "signin" ? "active" : ""}
              onClick={() => switchMode("signin")}
              type="button"
            >
              Log in
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>

          <div className="auth-mode-stack">
            <div className={`auth-mode-panel${mode === "signin" ? " is-active" : ""}`}>
              <h1>Welcome back</h1>
              <p className="auth-subtitle">Log in to continue to your dashboard.</p>
            </div>
            <div className={`auth-mode-panel${mode === "signup" ? " is-active" : ""}`}>
              <h1>Create your account</h1>
              <p className="auth-subtitle">
                Start uploading inspection photos and detecting damage early.
              </p>
            </div>
          </div>

          <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
            <div className={`auth-name-wrap${mode === "signup" ? " is-open" : ""}`}>
              <div className="auth-name-inner">
                <label className="field">
                  Full name
                  <input
                    autoComplete="name"
                    placeholder="Jordan Lee"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    tabIndex={mode === "signup" ? 0 : -1}
                  />
                </label>
              </div>
            </div>

            <label className="field">
              Work email
              <input
                autoComplete="email"
                placeholder="you@city.gov"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field">
              Password
              <div className="password-field">
                <input
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="v-btn v-btn-primary v-auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span className="auth-submit-label">
                    {mode === "signup" ? "Creating account…" : "Signing in…"}
                  </span>
                </>
              ) : (
                <span className="auth-submit-label">{mode === "signup" ? "Sign up" : "Log in"}</span>
              )}
            </button>
          </form>

          <div className="auth-mode-stack auth-mode-stack-footer">
            <p className={`auth-switch auth-mode-panel${mode === "signin" ? " is-active" : ""}`}>
              New to Verdant?{" "}
              <button onClick={() => switchMode("signup")} type="button">
                Sign up
              </button>
            </p>
            <p className={`auth-switch auth-mode-panel${mode === "signup" ? " is-active" : ""}`}>
              Already have an account?{" "}
              <button onClick={() => switchMode("signin")} type="button">
                Log in
              </button>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
