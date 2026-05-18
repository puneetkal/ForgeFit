// Home.tsx — Redesigned landing + auth with light/dark theme toggle
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

type Mode = "pick" | "coachLogin" | "clientLogin" | "clientSignup";

// ── Theme hook (shared, reads from <html data-theme>) ─────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("ff_theme") as "light" | "dark") || "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ff_theme", theme);
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return { theme, toggle };
}

// ── Theme Toggle Button ────────────────────────────────────────────────────────
function ThemeToggle({ theme, toggle }: { theme: string; toggle: () => void }) {
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title="Switch theme"
      aria-label="Toggle theme"
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}

export default function Home() {
  const nav = useNavigate();
  const { theme, toggle } = useTheme();

  const [mode, setMode] = useState<Mode>("pick");
  const [coachTab, setCoachTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setError("");
    setEmail("");
    setPassword("");
  }
  function go(m: Mode) {
    reset();
    setMode(m);
  }

  // ── Coach Login ────────────────────────────────────────────────────────────
  async function handleCoachLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const { data: coach } = await supabase
      .from("coaches")
      .select("id,name")
      .eq("user_id", data.user.id)
      .single();
    if (!coach) {
      setError("No coach account found.");
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "coach");
    localStorage.setItem("coach_id", coach.id);
    localStorage.setItem("coach_name", coach.name || "Coach");
    localStorage.setItem("user_id", data.user.id);
    nav("/coach");
    setLoading(false);
  }

  // ── Coach Register ─────────────────────────────────────────────────────────
  async function handleCoachRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: signupErr } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signupErr) {
      setError(signupErr.message);
      setLoading(false);
      return;
    }
    if (!data.user) {
      setError("Signup failed.");
      setLoading(false);
      return;
    }
    const { data: coach, error: dbErr } = await supabase
      .from("coaches")
      .insert({ user_id: data.user.id, name: name || email.split("@")[0] })
      .select()
      .single();
    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "coach");
    localStorage.setItem("coach_id", coach.id);
    localStorage.setItem("coach_name", coach.name);
    localStorage.setItem("user_id", data.user.id);
    nav("/coach");
    setLoading(false);
  }

  // ── Client Login ───────────────────────────────────────────────────────────
  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", data.user.id)
      .single();
    if (!client) {
      setError("No client account found.");
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "client");
    localStorage.setItem("client_id", client.id);
    localStorage.setItem("user_id", data.user.id);
    nav("/client");
    setLoading(false);
  }

  // ── Client Signup ──────────────────────────────────────────────────────────
  async function handleClientSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!name || !age || !height || !weight) {
      setError("Please fill all fields.");
      setLoading(false);
      return;
    }
    const { data, error: signupErr } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signupErr) {
      setError(signupErr.message);
      setLoading(false);
      return;
    }
    if (!data.user) {
      setError("Signup failed.");
      setLoading(false);
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: client, error: dbErr } = await supabase
      .from("clients")
      .insert({
        user_id: data.user.id,
        name,
        age: parseInt(age),
        height_cm: parseFloat(height),
        weight_kg: parseFloat(weight),
        connection_code: code,
      })
      .select()
      .single();
    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "client");
    localStorage.setItem("client_id", client.id);
    localStorage.setItem("user_id", data.user.id);
    localStorage.setItem("show_code", code);
    nav("/client");
    setLoading(false);
  }

  return (
    <div className="landing-page">
      <ThemeToggle theme={theme} toggle={toggle} />

      <div className="landing-inner">
        {/* ── PICK ROLE ── */}
        {mode === "pick" && (
          <div style={{ animation: "page-fade 0.3s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div className="landing-logo">
                Forge<span>Fit</span>
              </div>
              <div className="landing-tagline">
                Your personal coaching platform
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button className="role-card" onClick={() => go("coachLogin")}>
                <div
                  className="rc-icon"
                  style={{
                    background: "var(--accent-dim)",
                    color: "var(--accent)",
                  }}
                >
                  🏋️
                </div>
                <div>
                  <div className="rc-title">I'm a Coach</div>
                  <div className="rc-sub">
                    Manage clients, plans & nutrition
                  </div>
                </div>
                <div className="rc-arrow">›</div>
              </button>

              <button className="role-card" onClick={() => go("clientLogin")}>
                <div
                  className="rc-icon"
                  style={{
                    background: "var(--accent2-dim)",
                    color: "var(--accent2)",
                  }}
                >
                  💪
                </div>
                <div>
                  <div className="rc-title">I'm a Client</div>
                  <div className="rc-sub">Track diet, workouts & progress</div>
                </div>
                <div className="rc-arrow">›</div>
              </button>
            </div>

            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 32,
              }}
            >
              Built for serious athletes & their coaches
            </p>
          </div>
        )}

        {/* ── COACH AUTH ── */}
        {mode === "coachLogin" && (
          <div style={{ animation: "page-fade 0.3s ease" }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 20, paddingLeft: 0, gap: 6 }}
              onClick={() => go("pick")}
            >
              ← Back
            </button>
            <div className="auth-card">
              {/* Icon */}
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "var(--accent-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 16,
                }}
              >
                🏋️
              </div>
              <div className="auth-title">Coach Portal</div>
              <div className="auth-sub">
                Sign in or create your coach account
              </div>

              {/* Login / Register tabs */}
              <div className="plan-tabs" style={{ marginBottom: 20 }}>
                <button
                  className={`plan-tab${coachTab === "login" ? " active" : ""}`}
                  onClick={() => setCoachTab("login")}
                >
                  Login
                </button>
                <button
                  className={`plan-tab${
                    coachTab === "register" ? " active" : ""
                  }`}
                  onClick={() => setCoachTab("register")}
                >
                  Register
                </button>
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {coachTab === "login" ? (
                <form
                  onSubmit={handleCoachLogin}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="coach@example.com"
                  />
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="••••••••"
                  />
                  <button
                    className="btn btn-primary btn-full"
                    type="submit"
                    disabled={loading}
                    style={{ marginTop: 4 }}
                  >
                    {loading ? "Signing in…" : "Sign In"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleCoachRegister}
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
                  <Field
                    label="Your Name"
                    value={name}
                    onChange={setName}
                    placeholder="Coach Name"
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="coach@example.com"
                  />
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder="Min 6 characters"
                  />
                  <button
                    className="btn btn-primary btn-full"
                    type="submit"
                    disabled={loading}
                    style={{ marginTop: 4 }}
                  >
                    {loading ? "Creating…" : "Create Coach Account"}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENT LOGIN ── */}
        {mode === "clientLogin" && (
          <div style={{ animation: "page-fade 0.3s ease" }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 20, paddingLeft: 0, gap: 6 }}
              onClick={() => go("pick")}
            >
              ← Back
            </button>
            <div className="auth-card">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "var(--accent2-dim)",
                  color: "var(--accent2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 16,
                }}
              >
                💪
              </div>
              <div className="auth-title">Welcome back</div>
              <div className="auth-sub">Sign in to your client account</div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form
                onSubmit={handleClientLogin}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                />
                <button
                  className="btn btn-primary btn-full"
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: 4 }}
                >
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 10,
                    textAlign: "center",
                  }}
                >
                  Don't have an account?
                </p>
                <button
                  className="btn btn-outline btn-full"
                  onClick={() => go("clientSignup")}
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CLIENT SIGNUP ── */}
        {mode === "clientSignup" && (
          <div style={{ animation: "page-fade 0.3s ease" }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginBottom: 20, paddingLeft: 0, gap: 6 }}
              onClick={() => go("clientLogin")}
            >
              ← Back
            </button>
            <div className="auth-card">
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "var(--accent2-dim)",
                  color: "var(--accent2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 16,
                }}
              >
                🆕
              </div>
              <div className="auth-title">Create Account</div>
              <div className="auth-sub">
                Tell us about yourself to get started
              </div>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form
                onSubmit={handleClientSignup}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Field
                  label="Full Name"
                  value={name}
                  onChange={setName}
                  placeholder="Your Name"
                />
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                />
                <Field
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Min 6 characters"
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 10,
                  }}
                >
                  <div>
                    <label className="ff-label">Age</label>
                    <input
                      className="ff-input ff-input-sm"
                      type="number"
                      placeholder="yrs"
                      min="10"
                      max="100"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="ff-label">Height cm</label>
                    <input
                      className="ff-input ff-input-sm"
                      type="number"
                      placeholder="cm"
                      min="100"
                      max="250"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="ff-label">Weight kg</label>
                    <input
                      className="ff-input ff-input-sm"
                      type="number"
                      placeholder="kg"
                      min="30"
                      max="300"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-full"
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: 4 }}
                >
                  {loading ? "Creating account…" : "Get Started"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reusable field ─────────────────────────────────────────────────────────────
function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="ff-label">{label}</label>
      <input
        className="ff-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
      />
    </div>
  );
}
