import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { IconCheck } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};

    if (!email.endsWith("@thapar.edu")) {
      newErrors.email = "Only thapar.edu email addresses are allowed.";
    }
    if (!password) {
      newErrors.password = "Password is required.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length !== 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ email: data.message || "Login failed" });
        return;
      }

      login(data.data.token, data.data.user);
      navigate("/home");
    } catch (error) {
      console.error(error);
      setErrors({ email: "Server error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-split">

      {/* ── LEFT — branding ── */}
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo">OQ</div>
          <h1>Opportunity<br />Quest</h1>
          <p className="auth-tagline">
            Your gateway to internships, research projects and faculty collaborations — all in one place.
          </p>
        </div>

        <ul className="auth-features">
          <li><span className="check"><IconCheck /></span> Faculty-posted opportunities</li>
          <li><span className="check"><IconCheck /></span> Research, internships &amp; paid gigs</li>
          <li><span className="check"><IconCheck /></span> Filter by branch, year &amp; category</li>
        </ul>

        <p className="auth-institute">
          Designed &amp; built by Agrim Verma
        </p>
      </div>

      {/* ── RIGHT — form ── */}
      <div className="auth-right">
        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in with your Thapar account to continue.</p>
          </div>

          <div className="auth-field">
            <label htmlFor="loginEmail">Email</label>
            <input
              type="email"
              id="loginEmail"
              placeholder="you@thapar.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <span className="auth-error">{errors.email}</span>}
          </div>

          <div className="auth-field">
            <label htmlFor="loginPassword">Password</label>
            <input
              type="password"
              id="loginPassword"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="auth-error">{errors.password}</span>}
          </div>

          <button id="loginBtn" type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p className="auth-redirect">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Login;
