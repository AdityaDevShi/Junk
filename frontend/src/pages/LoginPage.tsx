import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { signInGoogle, signInEmail, signUpEmail, signInAnon } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page card">
      <h1>Welcome to MuniPeople</h1>

      <button
        className="btn btn-google btn-block"
        disabled={busy}
        onClick={() => void run(signInGoogle)}
      >
        Continue with Google
      </button>

      <div className="divider">
        <span>or</span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() =>
            mode === "in" ? signInEmail(email, pw) : signUpEmail(email, pw, name)
          );
        }}
      >
        {mode === "up" && (
          <input
            className="input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password (6+ characters)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
          minLength={6}
        />
        {error && <div className="error-box">{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="muted small center">
        {mode === "in" ? "New here? " : "Already have an account? "}
        <button className="link-btn" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Create an account" : "Sign in"}
        </button>
      </p>

      <div className="divider">
        <span>or</span>
      </div>

      <button
        className="btn btn-ghost btn-block"
        disabled={busy}
        onClick={() => void run(signInAnon)}
      >
        Continue anonymously
      </button>

      <Link to="/" className="link-btn center" style={{ marginTop: "0.8rem" }}>
        Skip — just browse the map
      </Link>
    </div>
  );
}
