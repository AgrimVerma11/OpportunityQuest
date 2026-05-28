import { useState } from "react";
import "./Register.css";
import { Link, useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  async function handleSubmit(e) {
    e.preventDefault();

    const newErrors = {};

    if (!formData.email.endsWith("@thapar.edu")) {
      newErrors.email = "Only thapar.edu emails allowed";
    }

    if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length !== 0) return;

    try {
      const res = await fetch("http://localhost:5174/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ email: data.message });
        return;
      }

      navigate("/");

    } catch (err) {
      console.error(err);
      setErrors({ email: "Server error" });
    }
  }

  return (
    <div className="register-wrapper">
      <form className="register-card" onSubmit={handleSubmit}>

        <h2>Create Account</h2>
        <p className="register-heading-note">
          Build your profile and discover curated opportunities.
        </p>

        <input
          name="name"
          id="registerName"
          placeholder="Full Name"
          onChange={handleChange}
        />

        <input
          name="email"
          type="email"
          id="registerEmail"
          placeholder="Thapar Email"
          onChange={handleChange}
        />
        {errors.email && <p>{errors.email}</p>}

        <input
          name="password"
          id="registerPassword"   // ✅ added
          type="password"
          placeholder="Password"
          onChange={handleChange}
        />
        {errors.password && <p>{errors.password}</p>}

        <input
          name="confirmPassword"
          id="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          onChange={handleChange}
        />
        {errors.confirmPassword && <p>{errors.confirmPassword}</p>}

        {/* ROLE */}
        <select name="role" id="registerRole" onChange={handleChange}>
          <option value="Student">Student</option>
          <option value="Faculty">Faculty</option>
        </select>

        {/* GENDER */}
        <select name="gender" id="registerGender" onChange={handleChange}>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>

        {/* STUDENT FIELDS */}
        {formData.role === "Student" && (
          <>
            <select name="branch" id="registerBranch" onChange={handleChange}>
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

            <select name="year" id="registerYear" onChange={handleChange}>
              <option value="">Select Year</option>
              <option value="1">1st Year</option>
              <option value="2">2nd Year</option>
              <option value="3">3rd Year</option>
              <option value="4">4th Year</option>
            </select>
          </>
        )}

        {/* FACULTY FIELDS */}
        {formData.role === "Faculty" && (
          <>
            <select name="department" id="registerDepartment" onChange={handleChange}>
              <option value="">Select Department</option>
              <option value="DCSE">DCSE</option>
              <option value="ECED">ECED</option>
              <option value="EID">EID</option>
              <option value="MEC">MEC</option>
              <option value="CIVIL">CIVIL</option>
              <option value="CHEMICAL">CHEMICAL</option>
              <option value="SOM">SOM</option>
            </select>

            <textarea
              name="interests"
              id="registerInterests"
              placeholder="Your interests (max 100 words)"
              onChange={handleChange}
            />
          </>
        )}

        <button id="registerBtn" type="submit">Register</button>

        <p>
          Already have an account? <Link to="/">Login</Link>
        </p>

      </form>
    </div>
  );
}

export default Register;