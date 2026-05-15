//Home.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

type Mode = "pick" | "coachLogin" | "clientLogin" | "clientSignup";

export default function Home() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("pick");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setError("");
    setEmail("");
    setPassword("");
  };

  // ── Coach Login ──────────────────────────────────────────
  async function handleCoachLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    // Verify coach role
    const { data: coach } = await supabase
      .from("coaches")
      .select("id")
      .eq("user_id", data.user.id)
      .single();
    if (!coach) {
      setError("No coach account found for this email.");
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "coach");
    localStorage.setItem("coach_id", coach.id);
    localStorage.setItem("user_id", data.user.id);
    nav("/coach");
    setLoading(false);
  }

  // ── Client Login ─────────────────────────────────────────
  async function handleClientLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", data.user.id)
      .single();
    if (!client) {
      setError("No client account found for this email.");
      setLoading(false);
      return;
    }
    localStorage.setItem("role", "client");
    localStorage.setItem("client_id", client.id);
    localStorage.setItem("user_id", data.user.id);
    nav("/client");
    setLoading(false);
  }

  // ── Client Signup ─────────────────────────────────────────
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

    // Generate 6-char connection code
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

  // ── Coach Register ────────────────────────────────────────
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
      .insert({
        user_id: data.user.id,
        name: name || email.split("@")[0],
      })
      .select()
      .single();

    if (dbErr) {
      setError(dbErr.message);
      setLoading(false);
      return;
    }

    localStorage.setItem("role", "coach");
    localStorage.setItem("coach_id", coach.id);
    localStorage.setItem("user_id", data.user.id);
    nav("/coach");
    setLoading(false);
  }

  const [coachTab, setCoachTab] = useState<"login" | "register">("login");

  return (
    <div className="page">
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* ── Pick role ── */}
        {mode === "pick" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "2.8rem",
                fontWeight: 800,
                fontFamily: "Syne, sans-serif",
                marginBottom: "0.5rem",
              }}
            >
              Forge<span style={{ color: "var(--accent)" }}>Fit</span>
            </div>
            <p style={{ color: "var(--muted)", marginBottom: "3rem" }}>
              Your coaching platform
            </p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <button
                className="card btn"
                style={{
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "2rem",
                  cursor: "pointer",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                  transition: "all 0.2s",
                }}
                onClick={() => {
                  reset();
                  setMode("coachLogin");
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <span style={{ fontSize: "2rem" }}>🏋️</span>
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                  }}
                >
                  I'm a Coach
                </span>
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 400,
                  }}
                >
                  Manage clients, plans & diet
                </span>
              </button>

              <button
                className="card btn"
                style={{
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "2rem",
                  cursor: "pointer",
                  textAlign: "center",
                  border: "1px solid var(--border)",
                  transition: "all 0.2s",
                }}
                onClick={() => {
                  reset();
                  setMode("clientLogin");
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--accent2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                <span style={{ fontSize: "2rem" }}>💪</span>
                <span
                  style={{
                    fontFamily: "Syne, sans-serif",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                  }}
                >
                  I'm a Client
                </span>
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 400,
                  }}
                >
                  Track diet, workouts & progress
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Coach Login / Register ── */}
        {mode === "coachLogin" && (
          <div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginBottom: "1.5rem" }}
              onClick={() => setMode("pick")}
            >
              ← Back
            </button>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.8rem",
                fontWeight: 800,
                marginBottom: "0.25rem",
              }}
            >
              Coach Portal
            </div>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
              Login or create your coach account
            </p>

            <div className="tab-bar" style={{ marginBottom: "1.5rem" }}>
              <button
                className={`tab ${coachTab === "login" ? "active" : ""}`}
                onClick={() => setCoachTab("login")}
              >
                Login
              </button>
              <button
                className={`tab ${coachTab === "register" ? "active" : ""}`}
                onClick={() => setCoachTab("register")}
              >
                Register
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {coachTab === "login" ? (
              <form
                onSubmit={handleCoachLogin}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary btn-full"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={handleCoachRegister}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div>
                  <label className="label">Your Name</label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <button
                  className="btn btn-primary btn-full"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Coach Account"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Client Login ── */}
        {mode === "clientLogin" && (
          <div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginBottom: "1.5rem" }}
              onClick={() => setMode("pick")}
            >
              ← Back
            </button>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.8rem",
                fontWeight: 800,
                marginBottom: "0.25rem",
              }}
            >
              Client Login
            </div>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
              Sign in to your account
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form
              onSubmit={handleClientLogin}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-full"
                onClick={() => {
                  reset();
                  setMode("clientSignup");
                }}
              >
                New here? Create account
              </button>
            </form>
          </div>
        )}

        {/* ── Client Signup ── */}
        {mode === "clientSignup" && (
          <div>
            <button
              className="btn btn-outline btn-sm"
              style={{ marginBottom: "1.5rem" }}
              onClick={() => setMode("clientLogin")}
            >
              ← Back
            </button>
            <div
              style={{
                fontFamily: "Syne, sans-serif",
                fontSize: "1.8rem",
                fontWeight: 800,
                marginBottom: "0.25rem",
              }}
            >
              Create Account
            </div>
            <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
              Tell us about yourself to get started
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form
              onSubmit={handleClientSignup}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label className="label">Age</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="yrs"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Height (cm)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="cm"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Weight (kg)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="kg"
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
              >
                {loading ? "Creating..." : "Create Account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
