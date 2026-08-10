import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { IconCheck } from "../components/Icons";
import Field from "../components/Field";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import GoogleAuthButton from "../components/GoogleAuthButton";
import "./Auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const notice = location.state?.notice;

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
      navigate(data.data.user.role === "Coordinator" ? "/approvals" : "/home");
    } catch (error) {
      console.error(error);
      setErrors({ email: "Server error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignedIn = (token, user) => {
    login(token, user);
    navigate(user.role === "Coordinator" ? "/approvals" : "/home");
  };

  const handleGooglePending = () => {
    setErrors({ email: "Your account is awaiting coordinator approval." });
  };

  return (
    <div className="auth-split">
      {/* ── Left — brand hero ── */}
      <div className="auth-left">
        <div className="auth-brand">
          <img
            src="/brand/opportunity-quest-lockup-dark.svg"
            alt="Opportunity Quest"
            className="auth-lockup"
          />
          <p className="auth-tagline">
            Your gateway to internships, research projects and faculty
            collaborations, all in one place.
          </p>
        </div>

        <ul className="auth-features">
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Faculty-posted opportunities
          </li>
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Research, internships &amp; paid gigs
          </li>
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Filter by branch, year &amp; category
          </li>
        </ul>

        <p className="auth-institute">Designed &amp; built by Agrim Verma</p>
      </div>

      {/* ── Right — form ── */}
      <div className="auth-right">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in with your Thapar account to continue.</p>
          </div>

          {notice && <p className="auth-notice">{notice}</p>}

          <Field id="loginEmail" label="Email" error={errors.email}>
            <input
              type="email"
              placeholder="you@thapar.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field id="loginPassword" label="Password" error={errors.password}>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <Button
            id="loginBtn"
            type="submit"
            variant="primary"
            block
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <GoogleAuthButton
            allowRegister={false}
            onSignedIn={handleGoogleSignedIn}
            onPending={handleGooglePending}
          />

          <p className="auth-redirect">
            Don&apos;t have an account? <Link to="/register">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
