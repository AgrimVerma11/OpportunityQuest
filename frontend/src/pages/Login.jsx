import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Login.css";
import Navbar from "./Navbar";

function Login() {

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [errors, setErrors] =
    useState({});

  const navigate = useNavigate();

  // =========================
  // SUBMIT
  // =========================

  async function handleSubmit(e) {

    e.preventDefault();

    const newErrors = {};

    // EMAIL VALIDATION
    if (
      !email.endsWith("@thapar.edu")
    ) {

      newErrors.email =
        "Only thapar.edu email addresses are allowed.";

    }

    // PASSWORD VALIDATION
    if (password.length < 6) {

      newErrors.password =
        "Password must be at least 6 characters long.";

    }

    setErrors(newErrors);

    if (
      Object.keys(newErrors).length !== 0
    ) return;

    try {

      const res = await fetch(
        "http://localhost:5174/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await res.json();

      console.log(data);

      // LOGIN FAILED
      if (!res.ok) {

        setErrors({
          email:
            data.message ||
            "Login failed",
        });

        return;
      }

      // STORE AUTH
      localStorage.setItem(
        "isLoggedIn",
        "true"
      );

      localStorage.setItem(
        "token",
        data.data.token
      );

      localStorage.setItem(
        "currentUser",

        JSON.stringify(
          data.data.user
        )
      );

      // NAVIGATE
      navigate("/home");

    } catch (error) {

      console.error(error);

      setErrors({
        email:
          "Server error. Please try again.",
      });

    }
  }

  return (
    <>
      <Navbar />

      <div className="login-wrapper">

        <form
          className="login-card"
          onSubmit={handleSubmit}
        >

          <h2 className="login-title">
            Welcome Back
          </h2>

          <p className="login-subtitle">
            Sign in to discover opportunities,
            internships and collaborations.
          </p>

          {/* EMAIL */}

          <input
            type="email"
            id="loginEmail"
            placeholder="Thapar Email"

            value={email}

            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          {errors.email && (
            <p className="error-text">
              {errors.email}
            </p>
          )}

          {/* PASSWORD */}

          <input
            type="password"
            id="loginPassword"
            placeholder="Password"

            value={password}

            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          {errors.password && (
            <p className="error-text">
              {errors.password}
            </p>
          )}

          {/* BUTTON */}

          <button
            id="loginBtn"
            type="submit"
          >
            Login
          </button>

          {/* REDIRECT */}

          <p className="redirect-text">

            Don't have an account?{" "}

            <Link
              to="/register"
              className="redirect-link"
            >
              Register
            </Link>

          </p>

        </form>

      </div>
    </>
  );
}

export default Login;