import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiRequest, getAuthToken } from "../services/api";
import "../styles/employee-invitation.css";

function EmployeeInvitation() {
  const { token, invitationId } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [acceptError, setAcceptError] = useState("");

  const isIdBasedInvitation = Boolean(invitationId);

  useEffect(() => {
    async function loadInvitation() {
      try {
        setLoading(true);
        setError("");

        let data;

        if (isIdBasedInvitation) {
          data = await apiRequest(`/workspaces/invitations/id/${invitationId}`);
        } else if (token) {
          data = await apiRequest(`/workspaces/invitations/${token}`);
        } else {
          throw new Error("Invitation reference is missing.");
        }

        setInvitation(data);
      } catch (err) {
        console.error("Invitation loading error:", err);

        setError(err.message || "Unable to load this invitation.");
      } finally {
        setLoading(false);
      }
    }

    loadInvitation();
  }, [token, invitationId, isIdBasedInvitation]);

  async function handleAcceptInvitation() {
    if (accepting) {
      return;
    }

    const authToken = getAuthToken();

    if (!authToken) {
      setAcceptError(
        "Please log in to the invited ZYRA account before entering this workspace.",
      );
      return;
    }

    try {
      setAccepting(true);
      setAcceptError("");

      if (isIdBasedInvitation) {
        await apiRequest(`/workspaces/invitations/id/${invitationId}/accept`, {
          method: "POST",
        });
      } else {
        await apiRequest(`/workspaces/invitations/${token}/accept`, {
          method: "POST",
        });
      }

      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Invitation acceptance error:", err);

      setAcceptError(
        err.message || "Unable to accept this invitation. Please try again.",
      );
    } finally {
      setAccepting(false);
    }
  }

  function handleDeclineInvitation() {
    navigate("/");
  }

  if (loading) {
    return (
      <main className="employee-invitation-state">
        <div className="employee-loading-orbit">
          <div className="employee-loading-core">Z</div>
        </div>

        <div className="employee-invitation-state-card">
          <span className="state-eyebrow">ZYRA / ACCESS SYSTEM</span>

          <h1>VERIFYING ACCESS</h1>

          <p>Please wait while we verify your workspace invitation.</p>

          <div className="state-progress">
            <span />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="employee-invitation-state">
        <div className="employee-invitation-error-symbol">!</div>

        <div className="employee-invitation-state-card">
          <span className="state-eyebrow">ZYRA / ACCESS SYSTEM</span>

          <h1>INVITATION UNAVAILABLE</h1>

          <p>{error}</p>

          <button
            type="button"
            className="state-back-button"
            onClick={() => navigate("/dashboard")}
          >
            RETURN TO ZYRA
          </button>
        </div>
      </main>
    );
  }

  const organizationName =
    invitation?.organization?.name ||
    invitation?.organization_name ||
    "ZYRA Technologies";

  const workspaceName =
    invitation?.workspace?.name ||
    invitation?.workspace_name ||
    "Company Workspace";

  const assignedRole =
    invitation?.invitation?.role || invitation?.role || "USER";

  const invitationStatus =
    invitation?.invitation?.status || invitation?.status || "PENDING";

  return (
    <main className="employee-invitation-page">
      {/* Ambient background */}
      <div className="employee-invitation-grid" />

      <div className="employee-invitation-glow employee-invitation-glow-one" />

      <div className="employee-invitation-glow employee-invitation-glow-two" />

      {/* Moving scan line */}
      <div className="employee-invitation-scanline" />

      {/* Decorative technical elements */}
      <div className="employee-tech-corner employee-tech-corner-tl">
        <span />
        <span />
        <span />
      </div>

      <div className="employee-tech-corner employee-tech-corner-br">
        <span />
        <span />
        <span />
      </div>

      <div className="employee-invitation-content">
        {/* Top navigation / system header */}
        <header className="employee-system-header">
          <div className="employee-brand">
            <div className="employee-brand-mark">
              <span>Z</span>
            </div>

            <div className="employee-brand-text">
              <strong>ZYRA</strong>
              <span>INTELLIGENT PROJECT WORKSPACE</span>
            </div>
          </div>

          <div className="employee-system-status">
            <span className="system-status-dot" />
            <span>ACCESS SYSTEM</span>
            <small>SECURE</small>
          </div>
        </header>

        {/* Main access area */}
        <section className="employee-access-section">
          <div className="employee-access-intro">
            <div className="access-code">
              <span>ACCESS REQUEST</span>
              <span className="access-code-line" />
              <span>01</span>
            </div>

            <p className="employee-access-eyebrow">
              ZYRA VERIFICATION PROTOCOL
            </p>

            <h1>
              WORKSPACE
              <span>ACCESS REQUEST</span>
            </h1>

            <p className="employee-access-description">
              You have been invited to join a secure ZYRA company workspace.
              Review your access details before continuing.
            </p>
          </div>

          {/* Main command center panel */}
          <section className="employee-access-card">
            <div className="employee-card-topline">
              <div>
                <span className="card-label">WORKSPACE IDENTIFICATION</span>

                <h2>{workspaceName}</h2>

                <p>{organizationName}</p>
              </div>

              <div className="verification-badge">
                <span className="verification-ring">
                  <span />
                </span>

                <div>
                  <strong>VERIFIED</strong>
                  <small>INVITATION</small>
                </div>
              </div>
            </div>

            <div className="employee-card-divider">
              <span />
            </div>

            {/* Access information */}
            <div className="employee-access-details">
              <div className="employee-detail">
                <span className="detail-number">01</span>

                <div className="detail-content">
                  <span className="detail-label">ORGANIZATION</span>

                  <strong>{organizationName}</strong>
                </div>
              </div>

              <div className="employee-detail">
                <span className="detail-number">02</span>

                <div className="detail-content">
                  <span className="detail-label">ROLE</span>

                  <div className="role-value">
                    <span className="role-pulse" />

                    <strong>{assignedRole}</strong>
                  </div>
                </div>
              </div>

              <div className="employee-detail">
                <span className="detail-number">03</span>

                <div className="detail-content">
                  <span className="detail-label">ACCESS LEVEL</span>

                  <strong>STANDARD</strong>
                </div>
              </div>
            </div>

            {/* Invitation status */}
            <div className="employee-status-panel">
              <div className="status-heading">
                <span className="status-icon">
                  <span />
                </span>

                <div>
                  <span>INVITATION STATUS</span>
                  <small>ACCESS REQUEST STATE</small>
                </div>
              </div>

              <div className="status-value">
                <span className="status-live-dot" />

                <strong>{String(invitationStatus).toUpperCase()}</strong>
              </div>
            </div>

            {/* Acceptance error */}
            {acceptError && (
              <div className="employee-invitation-error">
                <span className="error-icon">!</span>

                <div>
                  <strong>ACCESS ERROR</strong>

                  <p>{acceptError}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="employee-access-actions">
              <button
                type="button"
                className="employee-invitation-enter"
                onClick={handleAcceptInvitation}
                disabled={accepting}
              >
                <span className="enter-button-content">
                  <span>
                    {accepting ? "VERIFYING ACCESS..." : "ACCEPT & ENTER"}
                  </span>

                  <span className="enter-arrow">→</span>
                </span>

                <span className="button-scan" />
              </button>

              <button
                type="button"
                className="employee-invitation-decline"
                onClick={handleDeclineInvitation}
                disabled={accepting}
              >
                DECLINE INVITATION
              </button>
            </div>

            {/* Footer */}
            <div className="employee-card-footer">
              <div className="footer-security">
                <span className="footer-lock">◇</span>

                <span>SECURE WORKSPACE ACCESS</span>
              </div>

              <p>This invitation is valid for a limited time.</p>

              <span className="footer-code">ZYRA / AUTH-01</span>
            </div>
          </section>
        </section>

        {/* Bottom system indicator */}
        <footer className="employee-system-footer">
          <span>SYSTEM ONLINE</span>

          <span className="footer-line" />

          <span>IDENTITY VERIFICATION REQUIRED</span>

          <span className="footer-line" />

          <span>ZYRA ACCESS CONTROL</span>
        </footer>
      </div>
    </main>
  );
}

export default EmployeeInvitation;
