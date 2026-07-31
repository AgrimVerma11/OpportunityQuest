import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "./Navbar";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import CategoryTag from "../components/CategoryTag";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { useConfirm } from "../components/ConfirmProvider";
import { useToast } from "../components/ToastProvider";
import { IconInbox } from "../components/Icons";
import { fetchWithAuth, patchWithAuth } from "../utils/api";

import "./MyApplications.css";

const WITHDRAWABLE = ["Applied", "Viewed", "Shortlisted"];

function MyApplications() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);

  useEffect(() => {
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
    try {
      const res = await patchWithAuth(`/applications/${appId}/withdraw`);
      if (res.success) {
        load();
      } else {
        toast.error(res.message || "Could not withdraw application.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <Navbar />

      <div className="myapps">
        <PageHeader
          title="My applications"
          subtitle="Track the opportunities you have applied to and their status."
        />

        <div className="container myapps-body">
          {loading ? (
            <div className="myapps-status">
              <Spinner center label="Loading your applications" />
            </div>
          ) : applications.length === 0 ? (
            <EmptyState
              icon={<IconInbox />}
              title="No applications yet"
              description="Browse opportunities and apply to the ones that fit you."
              action={
                <button
                  className="btn btn-primary"
                  onClick={() => navigate("/home")}
                >
                  Explore opportunities
                </button>
              }
            />
          ) : (
            <div className="myapps-list">
              {applications.map((app) => {
                const opp = app.opportunity;
                const removed = !opp || opp.isDeleted;
                return (
                  <div className="card myapps-row" key={app._id}>
                    <div className="myapps-main">
                      <div className="myapps-title-line">
                        <h3 className="myapps-title">
                          {removed ? "Opportunity removed" : opp.title}
                        </h3>
                        <StatusBadge status={app.status} />
                      </div>
                      <div className="myapps-meta">
                        {!removed && <CategoryTag category={opp.category} />}
                        <span>
                          Applied {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="myapps-actions">
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
