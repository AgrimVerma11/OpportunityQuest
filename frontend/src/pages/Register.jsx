import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IconCheck } from "../components/Icons";
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
    interests: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters.";
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

    if (formData.role === "Faculty" && !formData.department) {
      newErrors.department = "Please select your department.";
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

      navigate("/");
    } catch (err) {
      console.error(err);
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
          <h1>Join Opportunity<br />Quest</h1>
          <p className="auth-tagline">
            Discover internships, research and faculty collaborations across campus — all in one place.
          </p>
        </div>

        <ul className="auth-features">
          <li><span className="check"><IconCheck /></span> Browse faculty-posted opportunities</li>
          <li><span className="check"><IconCheck /></span> Filter by your branch &amp; year</li>
          <li><span className="check"><IconCheck /></span> Apply to research &amp; paid gigs</li>
        </ul>

        <p className="auth-institute">
          Thapar Institute of Engineering &amp; Technology · Patiala
        </p>
      </div>

      {/* ── RIGHT — form ── */}
      <div className="auth-right">
        <form className="auth-form" onSubmit={handleSubmit}>

          <div className="auth-form-header">
            <h2>Create account</h2>
            <p>Build your profile and start exploring opportunities.</p>
          </div>

          {/* NAME */}
          <div className="auth-field">
            <label htmlFor="registerName">Full Name</label>
            <input
              name="name"
              id="registerName"
              placeholder="e.g. Rahul Sharma"
              onChange={handleChange}
            />
            {errors.name && <span className="auth-error">{errors.name}</span>}
          </div>

          {/* EMAIL */}
          <div className="auth-field">
            <label htmlFor="registerEmail">Thapar Email</label>
            <input
              name="email"
              type="email"
              id="registerEmail"
              placeholder="you@thapar.edu"
              onChange={handleChange}
            />
            {errors.email && <span className="auth-error">{errors.email}</span>}
          </div>

          {/* PASSWORD */}
          <div className="auth-field">
            <label htmlFor="registerPassword">Password</label>
            <input
              name="password"
              id="registerPassword"
              type="password"
              placeholder="At least 6 characters"
              onChange={handleChange}
            />
            {errors.password && <span className="auth-error">{errors.password}</span>}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="auth-field">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              name="confirmPassword"
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              onChange={handleChange}
            />
            {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
          </div>

          <div className="auth-divider">Account details</div>

          {/* ROLE + GENDER */}
          <div className="auth-row">
            <div className="auth-field">
              <label htmlFor="registerRole">Role</label>
              <select name="role" id="registerRole" onChange={handleChange} value={formData.role}>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
              </select>
            </div>

            <div className="auth-field">
              <label htmlFor="registerGender">Gender</label>
              <select name="gender" id="registerGender" onChange={handleChange} value={formData.gender}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* STUDENT FIELDS */}
          {formData.role === "Student" && (
            <div className="auth-row">
              <div className="auth-field">
                <label htmlFor="registerBranch">Branch</label>
                <select name="branch" id="registerBranch" onChange={handleChange} value={formData.branch}>
                  <option value="">Select Branch</option>
                  <option value="COE">COE</option>
                  <option value="COPC">COPC</option>
                  <option value="COBS">COBS</option>
                  <option value="DSAI">DSAI</option>
                  <option value="EEC">EEC</option>
                  <option value="ECE">ECE</option>
                  <option value="ENC">ENC</option>
                  <option value="RAI">RAI</option>
                  <option value="EVD">EVD</option>
                  <option value="EIC">EIC</option>
                  <option value="MEE">MEE</option>
                  <option value="MEC">MEC</option>
                  <option value="CHE">CHE</option>
                  <option value="CIE">CIE</option>
                  <option value="CCA">CCA</option>
                  <option value="ELE">ELE</option>
                  <option value="BME">BME</option>
                  <option value="BT">BT</option>
                </select>
                {errors.branch && <span className="auth-error">{errors.branch}</span>}
              </div>

              <div className="auth-field">
                <label htmlFor="registerYear">Year</label>
                <select name="year" id="registerYear" onChange={handleChange} value={formData.year}>
                  <option value="">Select Year</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
                {errors.year && <span className="auth-error">{errors.year}</span>}
              </div>
            </div>
          )}

          {/* FACULTY FIELDS */}
          {formData.role === "Faculty" && (
            <>
              <div className="auth-field">
                <label htmlFor="registerDepartment">Department</label>
                <select name="department" id="registerDepartment" onChange={handleChange} value={formData.department}>
                  <option value="">Select Department</option>
                  <option value="DCSE">DCSE</option>
                  <option value="ECED">ECED</option>
                  <option value="EID">EID</option>
                  <option value="MEC">MEC</option>
                  <option value="CIVIL">CIVIL</option>
                  <option value="CHEMICAL">CHEMICAL</option>
                  <option value="SOM">SOM</option>
                </select>
                {errors.department && <span className="auth-error">{errors.department}</span>}
              </div>

              <div className="auth-field">
                <label htmlFor="registerInterests">Research Interests <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span></label>
                <textarea
                  name="interests"
                  id="registerInterests"
                  placeholder="e.g. Machine Learning, IoT, Embedded Systems"
                  onChange={handleChange}
                  value={formData.interests}
                />
              </div>
            </>
          )}

          <button id="registerBtn" type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className="auth-redirect">
            Already have an account? <Link to="/">Sign in</Link>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Register;
