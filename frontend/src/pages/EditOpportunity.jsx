import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./CreateOpportunity.css";
import "./EditOpportunity.css";
import Navbar from "./Navbar";
import { useConfirm } from "../components/ConfirmProvider";
import { IconFile } from "../components/Icons";
import {
  fetchWithAuth,
  putWithAuth,
  uploadWithAuth,
  deleteWithAuth,
  fileUrl,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";

const BRANCHES = [
  "All", "COE", "COPC", "COBS", "DSAI", "EEC", "ECE",
  "ENC", "RAI", "EVD", "EIC", "MEE", "MEC", "CHE",
  "CIE", "CCA", "ELE", "BME", "BT",
];

const YEARS = ["All", "1", "2", "3", "4"];

function EditOpportunity() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [attachments, setAttachments] = useState([]);

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

  useEffect(() => {
    loadOpportunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOpportunity = async () => {
    try {
      const data = await fetchWithAuth(`/opportunities/${id}`);
      if (!data.success) {
        setError("Opportunity not found.");
        setLoading(false);
        return;
      }
      const opp = data.opportunity;
      if (opp.postedBy?._id !== currentUser.id && opp.postedBy !== currentUser.id) {
        navigate("/faculty");
        return;
      }
      setForm({
        title: opp.title || "",
        description: opp.description || "",
        category: opp.category || "Internship",
        contactEmail: opp.contactEmail || "",
        eligibleBranches: opp.eligibleBranches || [],
        eligibleYears: opp.eligibleYears || [],
        eligibleGender: opp.eligibleGender || "Any",
        tags: (opp.tags || []).join(", "),
        deadline: opp.deadline
          ? new Date(opp.deadline).toISOString().split("T")[0]
          : "",
      });
      setAttachments(opp.attachments || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load opportunity.");
    } finally {
      setLoading(false);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t !== ""),
      };
      const res = await putWithAuth(`/opportunities/${id}`, payload);
      if (!res.success) {
        setError(res.message || "Failed to update opportunity");
        return;
      }
      navigate("/faculty");
    } catch (err) {
      console.error(err);
      setError("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be under 5MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("attachment", file);
      const res = await uploadWithAuth(`/opportunities/${id}/attachments`, formData);
      if (res.success) {
        setAttachments((prev) => [...prev, res.attachment]);
      } else {
        setError(res.message || "Upload failed");
      }
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    const ok = await confirm({
      title: "Remove this attachment?",
      message: "The file will be permanently deleted.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await deleteWithAuth(
        `/opportunities/${id}/attachments/${attachmentId}`
      );
      if (res.success) {
        setAttachments((prev) => prev.filter((a) => a._id !== attachmentId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <p style={{ padding: "2rem" }}>Loading...</p>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="create-container">
        <form className="create-card" onSubmit={handleSubmit}>

          <div className="create-header">
            <h2>Edit Opportunity</h2>
            <p className="create-subtitle">
              Update the details of your posted opportunity.
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
              {BRANCHES.map((b) => (
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
              {YEARS.map((y) => (
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

          <select
            name="eligibleGender"
            value={form.eligibleGender}
            onChange={handleChange}
          >
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

          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* ATTACHMENTS — managed independently from the text form */}
        <div className="attachments-card">
          <h3>PDF Attachments</h3>
          <p className="attachments-hint">
            Attach project briefs, requirements or supporting documents (PDF, max 5MB each).
          </p>

          {attachments.length > 0 ? (
            <ul className="attachment-list">
              {attachments.map((att) => (
                <li key={att._id} className="attachment-item">
                  <a
                    href={fileUrl(att.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="attachment-link"
                  >
                    <IconFile /> {att.originalName}
                  </a>
                  <button
                    type="button"
                    className="attachment-delete-btn"
                    onClick={() => handleDeleteAttachment(att._id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-attachments">No attachments yet.</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={handleAttachmentUpload}
          />
          <button
            type="button"
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "+ Add PDF"}
          </button>
        </div>
      </div>
    </>
  );
}

export default EditOpportunity;
