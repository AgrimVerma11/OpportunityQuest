import { useEffect, useRef, useState } from "react";

import Modal from "./Modal";
import Field from "./Field";
import Button from "./Button";
import { postPublic } from "../utils/api";
import {
  BRANCH_OPTIONS,
  YEAR_OPTIONS,
  DEPARTMENT_OPTIONS,
} from "../constants/profileOptions";
import "./GoogleAuthButton.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Loads the Google Identity Services library once, on demand.
function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById("google-gsi");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.id = "google-gsi";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// "Continue with Google" for the sign-in and register screens. Verifies through
// the backend, signs the user in when possible, and collects a role for a
// first-time Google user. Renders nothing unless a client id is configured.
export default function GoogleAuthButton({
  label = "or",
  allowRegister = true,
  onSignedIn,
  onRegistered,
  onPending,
}) {
  const buttonRef = useRef(null);
  const credentialRef = useRef(null);

  const [error, setError] = useState("");
  const [onboarding, setOnboarding] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    role: "Student",
    gender: "Male",
    branch: "",
    year: "",
    department: "",
    employeeId: "",
  });

  const exchange = async (body, fromOnboarding = false) => {
    setError("");
    try {
      const res = await postPublic("/auth/google", body);
      if (res.status === "signed-in") {
        // A student who just onboarded is "created", not signed straight in —
        // the page sends them to sign in. Everyone else is signed in here.
        if (fromOnboarding && onRegistered) {
          onRegistered(res.data.user);
        } else {
          onSignedIn(res.data.token, res.data.user);
        }
      } else if (res.status === "needs-onboarding") {
        // On the sign-in screen we only sign in — an unknown Google account is
        // "not found," never a silent new account. Registration is its own screen.
        if (allowRegister) {
          setOnboarding({ email: res.email, name: res.name });
        } else {
          setError(
            "No account is linked to this Google account. Create one first."
          );
        }
      } else if (res.status === "pending") {
        setOnboarding(null);
        if (onPending) onPending();
      } else {
        setError(res.message || "Google sign-in could not be completed.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
  };

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !buttonRef.current) {
          return;
        }
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            credentialRef.current = response.credential;
            exchange({ credential: response.credential });
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          width: 320,
        });
      })
      .catch(() => setError("Could not load Google sign-in."));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submitOnboarding = async () => {
    if (form.role === "Student" && (!form.branch || !form.year)) {
      setError("Please select your branch and year.");
      return;
    }
    if (form.role === "Faculty" && (!form.department || !form.employeeId.trim())) {
      setError("Department and employee ID are required for faculty.");
      return;
    }

    setSubmitting(true);
    await exchange(
      {
        credential: credentialRef.current,
        role: form.role,
        gender: form.gender,
        branch: form.branch,
        year: form.year ? Number(form.year) : undefined,
        department: form.department,
        employeeId: form.employeeId.trim(),
      },
      true
    );
    setSubmitting(false);
  };

  if (!CLIENT_ID) return null;

  return (
    <div className="google-auth">
      <div className="google-auth-divider">
        <span>{label}</span>
      </div>

      <div ref={buttonRef} className="google-auth-button" />

      {error && !onboarding && <p className="google-auth-error">{error}</p>}

      {onboarding && (
        <Modal
          open
          onClose={() => setOnboarding(null)}
          title="Finish setting up"
          size="sm"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOnboarding(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={submitOnboarding}
                disabled={submitting}
              >
                {submitting ? "Creating…" : "Continue"}
              </Button>
            </>
          }
        >
          <p className="google-onboard-hint">
            Signing in as <strong>{onboarding.email}</strong>. A few details to
            complete your account.
          </p>

          <div className="google-onboard-fields">
            <Field id="g-role" label="I am a">
              <select name="role" value={form.role} onChange={setField}>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
              </select>
            </Field>

            <Field id="g-gender" label="Gender">
              <select name="gender" value={form.gender} onChange={setField}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            {form.role === "Student" ? (
              <>
                <Field id="g-branch" label="Branch">
                  <select name="branch" value={form.branch} onChange={setField}>
                    <option value="">Select branch</option>
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="g-year" label="Year">
                  <select name="year" value={form.year} onChange={setField}>
                    <option value="">Select year</option>
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field id="g-department" label="Department">
                  <select
                    name="department"
                    value={form.department}
                    onChange={setField}
                  >
                    <option value="">Select department</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field id="g-employeeId" label="Employee ID">
                  <input
                    name="employeeId"
                    value={form.employeeId}
                    onChange={setField}
                    placeholder="Your institutional employee ID"
                  />
                </Field>
              </>
            )}

            {error && <p className="google-auth-error">{error}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
