import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import StatusBadge from "../components/StatusBadge";
import { useConfirm } from "../components/ConfirmProvider";
import { fetchWithAuth, patchWithAuth } from "../utils/api";

import "./MyApplications.css";

const WITHDRAWABLE = ["Applied", "Viewed", "Shortlisted"];

function MyApplications() {
  const navigate = useNavigate();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }
    if (user?.role !== "Student") {
      navigate("/home");
      return;
    }
    load();
  }, []);

  const load = async () => {
    try {
      const data = await fetchWithAuth("/applications/mine");
      if (data.success) setApplications(data.applications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (appId) => {
    const ok = await confirm({
      title: "Withdraw application?",
      message:
        "Your application will be withdrawn. You can re-apply later after a short cooldown period.",
      confirmLabel: "Withdraw",
      tone: "danger",
    });
    if (!ok) return;
    setActionError("");
    try {
      const res = await patchWithAuth(`/applications/${appId}/withdraw`);
      if (res.success) {
        load();
      } else {
        setActionError(res.message || "Could not withdraw application.");
      }
    } catch (err) {
      console.error(err);
      setActionError("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <Navbar />

      <div className="applications-container">
        <div className="applications-inner">
          <div className="applications-hero">
            <h1>My Applications</h1>
            <p>Track the opportunities you have applied to and their status.</p>
          </div>

          {actionError && <div className="action-error-bar">{actionError}</div>}

          {loading ? (
            <p className="applications-loading">Loading…</p>
          ) : applications.length === 0 ? (
            <div className="applications-empty">
              <h2>No applications yet</h2>
              <p>Browse opportunities and apply to ones that fit you.</p>
              <button className="btn btn-primary" onClick={() => navigate("/home")}>
                Explore Opportunities
              </button>
            </div>
          ) : (
            <div className="applications-list">
              {applications.map((app) => {
                const opp = app.opportunity;
                const removed = !opp || opp.isDeleted;
                return (
                  <div className="application-row" key={app._id}>
                    <div className="application-main">
                      <div className="application-title-line">
                        <h3>{removed ? "Opportunity removed" : opp.title}</h3>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="application-meta">
                        {!removed && <span>{opp.category}</span>}
                        <span>
                          Applied {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="application-actions">
                      {!removed && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/opportunity/${opp._id}`)}
                        >
                          View
                        </button>
                      )}
                      {WITHDRAWABLE.includes(app.status) && (
                        <button
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => handleWithdraw(app._id)}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default MyApplications;
