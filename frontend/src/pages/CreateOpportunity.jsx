import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateOpportunity.css";
import "./EditOpportunity.css";
import { postWithAuth, uploadWithAuth } from "../utils/api";
import Navbar from "./Navbar";

function CreateOpportunity() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  useEffect(() => {
    if (!currentUser || currentUser.role !== "Faculty") {
      navigate("/home");
    }
  }, []);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Internship",
    contactEmail: "",
    eligibleBranches: [],
    eligibleYears: [],
    eligibleGender: "Any",
    tags: "",
    deadline: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [fileError, setFileError] = useState("");

  const branches = [
    "All", "COE", "COPC", "COBS", "DSAI", "EEC", "ECE",
    "ENC", "RAI", "EVD", "EIC", "MEE", "MEC", "CHE",
    "CIE", "CCA", "ELE", "BME", "BT",
  ];

  const years = ["All", "1", "2", "3", "4"];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleMultiSelect = (field, value) => {
    let current = [...form[field]];
    if (value === "All") {
      current = current.includes("All") ? [] : ["All"];
    } else {
      current = current.filter((v) => v !== "All");
      current = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
    }
    setForm({ ...form, [field]: current });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileError("");
    if (file.type !== "application/pdf") {
      setFileError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File size must be under 5MB.");
      return;
    }
    setPendingFiles((prev) => [...prev, file]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePending = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.title || !form.description || !form.contactEmail || !form.deadline) {
      setError("Please fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter((t) => t !== ""),
      };

      const res = await postWithAuth("/opportunities/create", payload);

      if (!res.success) {
        setError(
          res.errors?.length ? res.errors[0] : res.message || "Failed to create opportunity"
        );
        return;
      }

      // Upload any pending PDF attachments
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          const formData = new FormData();
          formData.append("attachment", file);
          await uploadWithAuth(`/opportunities/${res.opportunity._id}/attachments`, formData);
        }
      }

      const createAnother = window.confirm(
        "Opportunity created successfully ✅\n\nPress OK to create another opportunity.\nPress Cancel to go back to Faculty Corner."
      );

      if (createAnother) {
        setForm({
          title: "",
          description: "",
          category: "Internship",
          contactEmail: "",
          eligibleBranches: [],
          eligibleYears: [],
          eligibleGender: "Any",
          tags: "",
          deadline: "",
        });
        setPendingFiles([]);
      } else {
        navigate("/faculty");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to create opportunity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="create-container">
        <form className="create-card" onSubmit={handleSubmit}>

          <div className="create-header">
            <h2>Create Opportunity</h2>
            <p className="create-subtitle">
              Publish internships, research work, paid gigs and collaborations across campus.
            </p>
          </div>

          {error && <p className="error">{error}</p>}

          <input
            name="title"
            placeholder="Opportunity Title"
            value={form.title}
            onChange={handleChange}
          />

          <textarea
            name="description"
            placeholder="Describe the opportunity..."
            value={form.description}
            onChange={handleChange}
          />

          <select name="category" value={form.category} onChange={handleChange}>
            <option>Internship</option>
            <option>Research</option>
            <option>Paid Gig</option>
            <option>Faculty Project</option>
          </select>

          <input
            type="email"
            name="contactEmail"
            placeholder="Contact Email"
            value={form.contactEmail}
            onChange={handleChange}
          />

          <input
            type="date"
            name="deadline"
            value={form.deadline}
            onChange={handleChange}
          />

          {/* BRANCHES */}
          <div className="multi-section">
            <label>Eligible Branches</label>
            <div className="multi-options">
              {branches.map((b) => (
                <button
                  type="button"
                  key={b}
                  className={form.eligibleBranches.includes(b) ? "selected" : ""}
                  onClick={() => handleMultiSelect("eligibleBranches", b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* YEARS */}
          <div className="multi-section">
            <label>Eligible Years</label>
            <div className="multi-options">
              {years.map((y) => (
                <button
                  type="button"
                  key={y}
                  className={form.eligibleYears.includes(y) ? "selected" : ""}
                  onClick={() => handleMultiSelect("eligibleYears", y)}
                >
                  {y === "All" ? "All" : `${y} Year`}
                </button>
              ))}
            </div>
          </div>

          <select name="eligibleGender" value={form.eligibleGender} onChange={handleChange}>
            <option value="Any">Any</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <input
            name="tags"
            placeholder="Tags (comma separated)"
            value={form.tags}
            onChange={handleChange}
          />

          {/* PDF ATTACHMENTS */}
          <div className="multi-section">
            <label>
              PDF Attachments{" "}
              <span style={{ fontWeight: 400, color: "#888" }}>(optional)</span>
            </label>

            {pendingFiles.length > 0 && (
              <ul className="attachment-list" style={{ marginBottom: "0.8rem" }}>
                {pendingFiles.map((file, i) => (
                  <li key={i} className="attachment-item">
                    <span className="attachment-link">📄 {file.name}</span>
                    <button
                      type="button"
                      className="attachment-delete-btn"
                      onClick={() => handleRemovePending(i)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {fileError && (
              <p style={{ color: "#ff4d4f", fontSize: "0.85rem", margin: "0 0 0.6rem" }}>
                {fileError}
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              + Add PDF
            </button>
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? "Publishing..." : "Publish Opportunity"}
          </button>

        </form>
      </div>
    </>
  );
}

export default CreateOpportunity;
