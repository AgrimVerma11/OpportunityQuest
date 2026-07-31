import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import "./CreateOpportunity.css";
import Navbar from "./Navbar";
import PageHeader from "../components/PageHeader";
import OpportunityForm from "../components/OpportunityForm";
import AttachmentField from "../components/AttachmentField";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import { IconAlert } from "../components/Icons";
import {
  fetchWithAuth,
  putWithAuth,
  uploadWithAuth,
  deleteWithAuth,
  fileUrl,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";

function EditOpportunity() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [deadlinePassed, setDeadlinePassed] = useState(false);
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
        setLoadError("Opportunity not found.");
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
      setDeadlinePassed(
        Boolean(opp.deadline) && new Date(opp.deadline) < new Date()
      );
    } catch (err) {
      console.error(err);
      setLoadError("Failed to load opportunity.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleMultiSelect = (field, value) => {
    setForm((f) => {
      let current = [...f[field]];
      if (value === "All") {
        current = current.includes("All") ? [] : ["All"];
      } else {
        current = current.filter((v) => v !== "All");
        current = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
      }
      return { ...f, [field]: current };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter((t) => t !== ""),
      };
      const res = await putWithAuth(`/opportunities/${id}`, payload);
      if (!res.success) {
        toast.error(
          res.errors?.[0] || res.message || "Failed to update opportunity."
        );
        return;
      }
      toast.success("Changes saved.");
      navigate("/faculty");
    } catch (err) {
      console.error(err);
      toast.error("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // AttachmentField has already validated the PDF before calling this.
  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("attachment", file);
      const res = await uploadWithAuth(
        `/opportunities/${id}/attachments`,
        formData
      );
      if (res.success) {
        setAttachments((prev) => [...prev, res.attachment]);
      } else {
        toast.error(res.message || "Upload failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item) => {
    const ok = await confirm({
      title: "Remove this attachment?",
      message: "The file will be permanently deleted.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await deleteWithAuth(
        `/opportunities/${id}/attachments/${item.key}`
      );
      if (res.success) {
        setAttachments((prev) => prev.filter((a) => a._id !== item.key));
      } else {
        toast.error(res.message || "Could not remove attachment.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not remove attachment.");
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="opp-state">
          <Spinner center label="Loading opportunity" />
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Navbar />
        <div className="opp-state">
          <EmptyState
            icon={<IconAlert />}
            title="Could not load opportunity"
            description={loadError}
            action={
              <button
                className="btn btn-secondary"
                onClick={() => navigate("/faculty")}
              >
                Back to Faculty Corner
              </button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />

      <div className="opp-page">
        <PageHeader
          title="Edit opportunity"
          subtitle="Update the details of your posted opportunity."
        />

        <div className="opp-body">
          <form className="card opp-card" onSubmit={handleSubmit}>
            {deadlinePassed && (
              <p className="opp-notice">
                <IconAlert />
                <span>
                  This opportunity&rsquo;s deadline has passed. You can still
                  update its details; set a new future deadline below to make it
                  live for students again.
                </span>
              </p>
            )}

            <OpportunityForm
              form={form}
              onChange={handleChange}
              onMultiSelect={handleMultiSelect}
            />

            <div className="opp-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/faculty")}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Attachments are managed independently of the text form. */}
          <div className="card opp-attach-card">
            <h2 className="opp-attach-title">PDF attachments</h2>
            <AttachmentField
              label={null}
              hint="Attach project briefs, requirements or supporting documents. PDF, up to 5MB each."
              items={attachments.map((a) => ({
                key: a._id,
                name: a.originalName,
                href: fileUrl(a.url),
              }))}
              onAdd={handleUpload}
              onRemove={handleDelete}
              emptyText="No attachments yet."
              busy={uploading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default EditOpportunity;
