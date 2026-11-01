import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { apiRequest, getAuthToken } from "../services/api";

import "../styles/employee-invitation.css";

/*
|--------------------------------------------------------------------------
| ZYRA DASHBOARD ROUTING
|--------------------------------------------------------------------------
|
| Individual:
|   TEAM_LEADER -> LeadDash
|   USER        -> UserDash
|
| Company:
|   ADMIN       -> AdminDash
|   HR          -> HRDash
|   TEAM_LEADER -> TeamDash
|   USER        -> MemberDash
|
| Workspace role must come from workspace_members.role.
|
*/

function getDashboardPath(workspaceType, membershipRole) {
  const normalizedWorkspaceType = String(workspaceType || "")
    .trim()
    .toUpperCase();

  const normalizedRole = String(membershipRole || "")
    .trim()
    .toUpperCase();

  if (normalizedWorkspaceType === "INDIVIDUAL") {
    switch (normalizedRole) {
      case "TEAM_LEADER":
        return "/dashboard/individual/team-leader";

      case "USER":
        return "/dashboard/individual/user";

      default:
        return null;
    }
  }

  if (normalizedWorkspaceType === "COMPANY") {
    switch (normalizedRole) {
      case "ADMIN":
        return "/dashboard/company/admin";

      case "HR":
        return "/dashboard/company/hr";

      case "TEAM_LEADER":
        return "/dashboard/company/team-leader";

      case "USER":
        return "/dashboard/company/user";

      default:
        return null;
    }
  }

  return null;
}

function EmployeeInvitation() {
  const { token, invitationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [acceptError, setAcceptError] = useState("");

  const isIdBasedInvitation = Boolean(invitationId);

  /*
  |--------------------------------------------------------------------------
  | RETURN NAVIGATION
  |--------------------------------------------------------------------------
  |
  | If Notifications opened the invitation, return to Notifications.
  | If the invitation was opened directly from an email or external link,
  | return to the ZYRA dashboard instead of the public landing page.
  |
  | Only accept a safe internal application path from navigation state.
  |
  */

  function getReturnDestination() {
    const returnTo = location.state?.returnTo;

    if (
      typeof returnTo === "string" &&
      returnTo.startsWith("/") &&
      !returnTo.startsWith("//") &&
      !returnTo.startsWith("/employee-invitation/")
    ) {
      return returnTo;
    }

    return "/dashboard";
  }

  function handleReturnFromInvitation() {
    const destination = getReturnDestination();

    navigate(destination, {
      replace: true,
    });
  }

  const returnToNotifications =
    typeof location.state?.returnTo === "string" &&
    location.state.returnTo.startsWith("/notifications");

  /*
  |--------------------------------------------------------------------------
  | Load and validate the invitation
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      try {
        setLoading(true);
        setError("");
        setAcceptError("");

        let data;

        if (isIdBasedInvitation) {
          data = await apiRequest(
            `/workspaces/invitations/id/${encodeURIComponent(invitationId)}`,
          );
        } else if (token) {
          data = await apiRequest(
            `/workspaces/invitations/${encodeURIComponent(token)}`,
          );
        } else {
          throw new Error("Invitation reference is missing.");
        }

        if (!cancelled) {
          setInvitation(data);
        }
      } catch (requestError) {
        console.error("Invitation loading error:", requestError);

        if (!cancelled) {
          setError(requestError.message || "Unable to load this invitation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token, invitationId, isIdBasedInvitation]);

  /*
  |--------------------------------------------------------------------------
  | Accept the invitation
  |--------------------------------------------------------------------------
  |
  | The frontend does not create memberships.
  |
  | The backend validates the signed-in account and invitation, then
  | creates workspace membership and the appropriate existing team or
  | organization membership in a transaction.
  |
  | The frontend uses the acceptance response to select the destination.
  |
  */

  async function handleAcceptInvitation() {
    if (accepting) {
      return;
    }

    const authToken = getAuthToken();

    if (!authToken) {
      setAcceptError(
        "Please log in to the ZYRA account that received this invitation before accepting it.",
      );

      return;
    }

    try {
      setAccepting(true);
      setAcceptError("");

      let acceptanceResult;

      if (isIdBasedInvitation) {
        acceptanceResult = await apiRequest(
          `/workspaces/invitations/id/${encodeURIComponent(
            invitationId,
          )}/accept`,
          {
            method: "POST",
          },
        );
      } else {
        acceptanceResult = await apiRequest(
          `/workspaces/invitations/${encodeURIComponent(token)}/accept`,
          {
            method: "POST",
          },
        );
      }

      /*
       * Use the accepted workspace and membership returned by the backend.
       * The validation response is the fallback for missing response fields.
       */

      const acceptedWorkspaceType =
        acceptanceResult?.workspace?.type ??
        invitation?.workspace?.type ??
        invitation?.workspace_type;

      const acceptedMembershipRole =
        acceptanceResult?.membership?.role ??
        acceptanceResult?.invitation?.role ??
        invitation?.invitation?.role ??
        invitation?.role;

      const destination = getDashboardPath(
        acceptedWorkspaceType,
        acceptedMembershipRole,
      );

      if (!destination) {
        /*
         * The invitation might already have been accepted by the backend.
         * Do not pretend acceptance failed or submit it again automatically.
         */

        setAcceptError(
          "The invitation was processed, but ZYRA could not determine the correct dashboard from the returned workspace role. Please sign in again or contact your workspace administrator.",
        );

        return;
      }

      /*
       * Reload at the correct dashboard route so the application can
       * retrieve the user's latest memberships.
       */

      window.location.assign(destination);
    } catch (requestError) {
      console.error("Invitation acceptance error:", requestError);

      setAcceptError(
        requestError.message ||
          "Unable to accept this invitation. Please try again.",
      );
    } finally {
      setAccepting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Leave the invitation screen
  |--------------------------------------------------------------------------
  */

  function handleDeclineInvitation() {
    if (accepting) {
      return;
    }

    navigate(getReturnDestination(), {
      replace: true,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Loading state
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | Invalid or unavailable invitation
  |--------------------------------------------------------------------------
  */

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
            onClick={handleReturnFromInvitation}
          >
            {returnToNotifications
              ? "RETURN TO NOTIFICATIONS"
              : "RETURN TO DASHBOARD"}
          </button>
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Prepare invitation information
  |--------------------------------------------------------------------------
  */

  const workspaceType = String(
    invitation?.workspace?.type || invitation?.workspace_type || "",
  )
    .trim()
    .toUpperCase();

  const isIndividualWorkspace = workspaceType === "INDIVIDUAL";

  const organizationName =
    invitation?.organization?.name ||
    invitation?.organization_name ||
    (isIndividualWorkspace ? "Individual Workspace" : "ZYRA Technologies");

  const workspaceName =
    invitation?.workspace?.name ||
    invitation?.workspace_name ||
    (isIndividualWorkspace ? "Individual Workspace" : "Company Workspace");

  const assignedRole =
    invitation?.invitation?.role || invitation?.role || "USER";

  const invitationStatus =
    invitation?.invitation?.status || invitation?.status || "PENDING";

  const assignedProject =
    invitation?.project || invitation?.invitation?.project || null;

  const assignedProjectName =
    assignedProject?.name || assignedProject?.title || "";

  /*
  |--------------------------------------------------------------------------
  | Invitation page
  |--------------------------------------------------------------------------
  */

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
        {/* System header */}

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
              You have been invited to join a secure ZYRA workspace. Review your
              access details before continuing.
            </p>
          </div>

          {/* Main access card */}

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
                  <span className="detail-label">WORKSPACE TYPE</span>

                  <strong>
                    {isIndividualWorkspace
                      ? "INDIVIDUAL WORKSPACE"
                      : "COMPANY WORKSPACE"}
                  </strong>
                </div>
              </div>

              <div className="employee-detail">
                <span className="detail-number">02</span>

                <div className="detail-content">
                  <span className="detail-label">ASSIGNED ROLE</span>

                  <div className="role-value">
                    <span className="role-pulse" />

                    <strong>{assignedRole}</strong>
                  </div>
                </div>
              </div>

              <div className="employee-detail">
                <span className="detail-number">03</span>

                <div className="detail-content">
                  <span className="detail-label">
                    {isIndividualWorkspace
                      ? "ASSIGNED PROJECT"
                      : "ACCESS LEVEL"}
                  </span>

                  <strong>
                    {isIndividualWorkspace
                      ? assignedProjectName || "No project assigned"
                      : "STANDARD"}
                  </strong>
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
              <div className="employee-invitation-error" role="alert">
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
                disabled={accepting || invitationStatus !== "PENDING"}
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
                LEAVE INVITATION
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
