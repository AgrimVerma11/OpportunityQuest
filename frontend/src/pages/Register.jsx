import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconCheck } from "../components/Icons";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import GoogleAuthButton from "../components/GoogleAuthButton";
import { BRANCH_OPTIONS, DEPARTMENT_OPTIONS } from "../constants/profileOptions";
import "./Auth.css";

function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "Student",
    gender: "Male",
    branch: "",
    year: "",
    department: "",
    employeeId: "",
    interests: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required.";
    }

    if (!formData.email.endsWith("@thapar.edu")) {
      newErrors.email = "Only thapar.edu emails are allowed.";
    }

    if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    if (formData.role === "Student") {
      if (!formData.branch) {
        newErrors.branch = "Please select your branch.";
      }
      if (!formData.year) {
        newErrors.year = "Please select your year.";
      }
    }

    if (formData.role === "Faculty") {
      if (!formData.department) {
        newErrors.department = "Please select your department.";
      }
      if (!formData.employeeId.trim()) {
        newErrors.employeeId =
          "Employee ID is required so a coordinator can verify you.";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length !== 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ email: data.message || "Registration failed." });
        return;
      }

      if (formData.role === "Faculty") {
        setSubmitted(true);
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error(err);
      setErrors({ email: "Server error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  const handleGoogleSignedIn = (token, user) => {
    login(token, user);
    navigate(user.role === "Coordinator" ? "/approvals" : "/home");
  };

  // A student who just created their account via Google is sent to sign in,
  // rather than dropped straight into the app.
  const handleStudentRegistered = () => {
    navigate("/", {
      state: { notice: "Account created. Please sign in to continue." },
    });
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
            Discover internships, research and faculty collaborations across
            campus, all in one place.
          </p>
        </div>

        <ul className="auth-features">
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Browse faculty-posted opportunities
          </li>
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Filter by your branch &amp; year
          </li>
          <li>
            <span className="check">
              <IconCheck />
            </span>
            Apply to research &amp; paid gigs
          </li>
        </ul>

        <p className="auth-institute">Designed &amp; built by Agrim Verma</p>
      </div>

      {/* ── Right — form ── */}
      <div className="auth-right">
        {submitted ? (
          <div className="auth-form">
            <div className="auth-form-header">
              <h2>Request submitted</h2>
              <p>Your faculty account is with the coordinator for review.</p>
            </div>
            <p className="auth-note">
              You&rsquo;ll be able to sign in once it&rsquo;s approved. We&rsquo;ll
              keep it under your Thapar email. Come back and sign in when
              it&rsquo;s ready.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => navigate("/")}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-header">
              <h2>Create account</h2>
              <p>Build your profile and start exploring opportunities.</p>
            </div>

            <Field id="registerName" label="Full name" error={errors.name}>
              <input
                name="name"
                placeholder="e.g. Rahul Sharma"
                onChange={handleChange}
              />
            </Field>

            <Field id="registerEmail" label="Thapar email" error={errors.email}>
              <input
                name="email"
                type="email"
                placeholder="you@thapar.edu"
                onChange={handleChange}
              />
            </Field>

            <Field
              id="registerPassword"
              label="Password"
              error={errors.password}
            >
              <input
                name="password"
                type="password"
                placeholder="At least 8 characters"
                onChange={handleChange}
              />
            </Field>

            <Field
              id="confirmPassword"
              label="Confirm password"
              error={errors.confirmPassword}
            >
              <input
                name="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                onChange={handleChange}
              />
            </Field>

            <div className="auth-divider">Account details</div>

            <div className="auth-row">
              <Field id="registerRole" label="Role">
                <select name="role" onChange={handleChange} value={formData.role}>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                </select>
              </Field>

              <Field id="registerGender" label="Gender">
                <select
                  name="gender"
                  onChange={handleChange}
                  value={formData.gender}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>

            {formData.role === "Student" && (
              <div className="auth-row">
                <Field id="registerBranch" label="Branch" error={errors.branch}>
                  <select
                    name="branch"
                    onChange={handleChange}
                    value={formData.branch}
                  >
                    <option value="">Select branch</option>
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="registerYear" label="Year" error={errors.year}>
                  <select
                    name="year"
                    onChange={handleChange}
                    value={formData.year}
                  >
                    <option value="">Select year</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </Field>
              </div>
            )}

            {formData.role === "Faculty" && (
              <>
                <Field
                  id="registerDepartment"
                  label="Department"
                  error={errors.department}
                >
                  <select
                    name="department"
                    onChange={handleChange}
                    value={formData.department}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  id="registerEmployeeId"
                  label="Employee ID"
                  error={errors.employeeId}
                >
                  <input
                    name="employeeId"
                    placeholder="Your institutional employee ID"
                    onChange={handleChange}
                    value={formData.employeeId}
                  />
                </Field>

                <Field
                  id="registerInterests"
                  label={
                    <>
                      Research interests{" "}
                      <span className="auth-optional">(optional)</span>
                    </>
                  }
                >
                  <textarea
                    name="interests"
                    placeholder="e.g. Machine Learning, IoT, Embedded Systems"
                    onChange={handleChange}
                    value={formData.interests}
                  />
                </Field>
              </>
            )}

            <button
              id="registerBtn"
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <GoogleAuthButton
              onSignedIn={handleGoogleSignedIn}
              onRegistered={handleStudentRegistered}
              onPending={() => setSubmitted(true)}
            />

            <p className="auth-redirect">
              Already have an account? <Link to="/">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default Register;
