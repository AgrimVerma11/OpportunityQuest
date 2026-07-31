import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./CreateOpportunity.css";
import { postWithAuth, uploadWithAuth } from "../utils/api";
import Navbar from "./Navbar";
import PageHeader from "../components/PageHeader";
import OpportunityForm from "../components/OpportunityForm";
import AttachmentField from "../components/AttachmentField";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Internship",
  contactEmail: "",
  eligibleBranches: [],
  eligibleYears: [],
  eligibleGender: "Any",
  tags: "",
  deadline: "",
};

function CreateOpportunity() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);

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

    if (!form.title || !form.description || !form.contactEmail || !form.deadline) {
      toast.error("Please fill all required fields.");
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
        toast.error(
          res.errors?.length
            ? res.errors[0]
            : res.message || "Failed to create opportunity."
        );
        return;
      }

      // Upload any pending PDF attachments once the opportunity exists.
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("attachment", file);
        await uploadWithAuth(
          `/opportunities/${res.opportunity._id}/attachments`,
          formData
        );
      }

      const createAnother = await confirm({
        title: "Opportunity published",
        message:
          "Your opportunity is now live for students. Would you like to create another?",
        confirmLabel: "Create another",
        cancelLabel: "Back to Faculty Corner",
      });

      if (createAnother) {
        setForm(EMPTY_FORM);
        setPendingFiles([]);
        window.scrollTo({ top: 0 });
      } else {
        navigate("/faculty");
      }
    } catch (err) {
      console.error(err);
      toast.error("Unable to create opportunity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <div className="opp-page">
        <PageHeader
          title="Create opportunity"
          subtitle="Publish internships, research work, paid gigs and collaborations across campus."
        />

        <div className="opp-body">
          <form className="card opp-card" onSubmit={handleSubmit}>
            <OpportunityForm
              form={form}
              onChange={handleChange}
              onMultiSelect={handleMultiSelect}
            />

            <div className="opp-attach">
              <AttachmentField
                hint="Attach a brief or supporting document. PDF, up to 5MB each."
                items={pendingFiles.map((f, i) => ({ key: i, name: f.name }))}
                onAdd={(file) => setPendingFiles((p) => [...p, file])}
                onRemove={(it) =>
                  setPendingFiles((p) => p.filter((_, i) => i !== it.key))
                }
              />
            </div>

            <div className="opp-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Publishing…" : "Publish opportunity"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/faculty")}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default CreateOpportunity;
