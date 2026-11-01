import { useCallback, useEffect, useState } from "react";

import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";

import { apiRequest } from "../services/api";

import "../styles/invitations.css";

// ========================================================
// HELPERS
// ========================================================

function formatDate(value) {
  if (!value) {
    return "Not specified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not specified";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInvitationId(invitation) {
  return invitation?.invitation_id ?? invitation?.id ?? null;
}

function getWorkspaceType(invitation) {
  return String(invitation?.workspace_type || "")
    .trim()
    .toUpperCase();
}

// ========================================================
// ROLE-BASED DASHBOARD ROUTING
// ========================================================

function getDashboardPath(workspaceType, membershipRole) {
  const normalizedWorkspaceType = String(workspaceType || "")
    .trim()
    .toUpperCase();

  const normalizedRole = String(membershipRole || "")
    .trim()
    .toUpperCase();

  if (normalizedWorkspaceType === "INDIVIDUAL") {
    const individualDashboardPaths = {
      TEAM_LEADER: "/dashboard/individual/team-leader",
      USER: "/dashboard/individual/user",
    };

    return individualDashboardPaths[normalizedRole] || null;
  }

  if (normalizedWorkspaceType === "COMPANY") {
    const companyDashboardPaths = {
      ADMIN: "/dashboard/company/admin",
      HR: "/dashboard/company/hr",
      TEAM_LEADER: "/dashboard/company/team-leader",
      USER: "/dashboard/company/user",
    };

    return companyDashboardPaths[normalizedRole] || null;
  }

  return null;
}

// ========================================================
// INVITATIONS PAGE
// ========================================================

function Invitations() {
  const [invitations, setInvitations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [processingInvitationId, setProcessingInvitationId] = useState(null);

  const [processingAction, setProcessingAction] = useState(null);

  const isProcessing = processingInvitationId !== null;

  // ======================================================
  // LOAD THE SIGNED-IN USER'S PENDING INVITATIONS
  // ======================================================

  const loadInvitations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await apiRequest("/workspaces/my-invitations");

      const pendingInvitations = Array.isArray(response?.invitations)
        ? response.invitations
        : [];

      setInvitations(pendingInvitations);
    } catch (requestError) {
      console.error("Failed to load workspace invitations:", requestError);

      setInvitations([]);

      setError(
        requestError?.message ||
          "We couldn't load your invitations. Please try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  // ======================================================
  // ACCEPT INVITATION
  // ======================================================

  async function handleAcceptInvitation(invitation) {
    const invitationId = getInvitationId(invitation);

    if (!invitationId) {
      setError(
        "This invitation is missing its ID. Please refresh and try again.",
      );

      return;
    }

    const workspaceName = invitation.workspace_name || "this workspace";

    const confirmed = window.confirm(
      `Accept the invitation to join "${workspaceName}" as ${
        invitation.role || "USER"
      }?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccessMessage("");

    setProcessingInvitationId(String(invitationId));
    setProcessingAction("accept");

    try {
      const response = await apiRequest(
        `/workspaces/invitations/id/${encodeURIComponent(invitationId)}/accept`,
        {
          method: "POST",
        },
      );

      // The backend creates the workspace membership and marks
      // the invitation as ACCEPTED.

      const workspaceType =
        response?.workspace?.type || invitation.workspace_type;

      const membershipRole = response?.membership?.role || invitation.role;

      const destination = getDashboardPath(workspaceType, membershipRole);

      // Remove the accepted invitation from the local pending list.
      setInvitations((currentInvitations) =>
        currentInvitations.filter(
          (item) => String(getInvitationId(item)) !== String(invitationId),
        ),
      );

      if (!destination) {
        setSuccessMessage(
          "Your invitation was accepted, but we couldn't determine your dashboard. Please refresh the page or check your dashboard routes.",
        );

        return;
      }

      // Reload the application so the newly created workspace
      // membership can be picked up by the dashboard.
      window.location.assign(destination);
    } catch (requestError) {
      console.error("Failed to accept workspace invitation:", requestError);

      setError(
        requestError?.message ||
          "We couldn't accept this invitation. Please try again.",
      );
    } finally {
      setProcessingInvitationId(null);
      setProcessingAction(null);
    }
  }

  // ======================================================
  // DECLINE INVITATION
  // ======================================================

  async function handleDeclineInvitation(invitation) {
    const invitationId = getInvitationId(invitation);

    if (!invitationId) {
      setError(
        "This invitation is missing its ID. Please refresh and try again.",
      );

      return;
    }

    const workspaceName = invitation.workspace_name || "this workspace";

    const confirmed = window.confirm(
      `Are you sure you want to decline the invitation to "${workspaceName}"?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccessMessage("");

    setProcessingInvitationId(String(invitationId));
    setProcessingAction("decline");

    try {
      await apiRequest(
        `/workspaces/invitations/id/${encodeURIComponent(
          invitationId,
        )}/decline`,
        {
          method: "POST",
        },
      );

      // The backend changes the invitation status to CANCELLED.
      // Remove it from the current list without requiring a reload.
      setInvitations((currentInvitations) =>
        currentInvitations.filter(
          (item) => String(getInvitationId(item)) !== String(invitationId),
        ),
      );

      setSuccessMessage(
        `The invitation to "${workspaceName}" was declined successfully.`,
      );
    } catch (requestError) {
      console.error("Failed to decline workspace invitation:", requestError);

      setError(
        requestError?.message ||
          "We couldn't decline this invitation. Please try again.",
      );
    } finally {
      setProcessingInvitationId(null);
      setProcessingAction(null);
    }
  }

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <main className="zyra-invitations-page">
      {/* PAGE HEADER */}

      <header className="zi-page-header">
        <div className="zi-heading-content">
          <div className="zi-eyebrow">
            <span className="zi-eyebrow-dot" />
            WORKSPACE ACCESS
          </div>

          <h1>
            Your <span>Invitations</span>
          </h1>

          <p>
            Review workspace invitations and decide which teams you want to
            join. Accept or decline directly from this page.
          </p>
        </div>

        <button
          type="button"
          className="zi-refresh-button"
          onClick={() => loadInvitations(true)}
          disabled={loading || refreshing || isProcessing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? "zi-refresh-spinning" : ""}
          />

          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* SUMMARY */}

      <section className="zi-summary-card">
        <div className="zi-summary-icon">
          <Mail size={22} />
        </div>

        <div className="zi-summary-copy">
          <span>YOUR PENDING INVITATIONS</span>

          <strong>{loading ? "Loading..." : invitations.length}</strong>

          <p>
            {loading
              ? "Checking for workspace invitations."
              : invitations.length === 1
                ? "You have one invitation waiting for your review."
                : invitations.length > 1
                  ? "You have invitations waiting for your review."
                  : "New workspace invitations will appear here."}
          </p>
        </div>

        <div className="zi-summary-status">
          <span className="zi-summary-status-dot" />
          {loading ? "CHECKING" : "LIVE STATUS"}
        </div>
      </section>

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div className="zi-success-message" role="status" aria-live="polite">
          <CheckCircle2 size={20} />

          <div>
            <strong>Invitation updated</strong>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && (
        <div className="zi-error-message" role="alert">
          <AlertCircle size={19} />

          <div>
            <strong>Invitation request failed</strong>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => loadInvitations(true)}
              disabled={refreshing || isProcessing}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* INVITATION LIST */}

      <section className="zi-invitation-section">
        <div className="zi-section-heading">
          <div>
            <span className="zi-section-eyebrow">INCOMING ACCESS</span>

            <h2>Workspace invitations</h2>
          </div>

          {!loading && invitations.length > 0 && (
            <span className="zi-count-badge">
              {invitations.length}{" "}
              {invitations.length === 1 ? "invitation" : "invitations"}
            </span>
          )}
        </div>

        {/* LOADING */}

        {loading && (
          <div className="zi-state-card">
            <div className="zi-loading-icon">
              <RefreshCw size={25} />
            </div>

            <h3>Finding your invitations</h3>

            <p>
              We're checking for pending workspace invitations associated with
              your account.
            </p>
          </div>
        )}

        {/* EMPTY STATE */}

        {!loading && !error && invitations.length === 0 && (
          <div className="zi-state-card">
            <div className="zi-empty-icon">
              <Inbox size={29} />
            </div>

            <h3>You're all caught up</h3>

            <p>
              There are no pending workspace invitations for your account right
              now. When someone invites you to a workspace, it will appear here.
            </p>

            <button
              type="button"
              className="zi-empty-refresh"
              onClick={() => loadInvitations(true)}
              disabled={refreshing || isProcessing}
            >
              <RefreshCw
                size={15}
                className={refreshing ? "zi-refresh-spinning" : ""}
              />
              Check again
            </button>
          </div>
        )}

        {/* INVITATION CARDS */}

        {!loading && invitations.length > 0 && (
          <div className="zi-invitation-list">
            {invitations.map((invitation, index) => {
              const invitationId = getInvitationId(invitation);

              const workspaceType = getWorkspaceType(invitation);

              const isIndividualWorkspace = workspaceType === "INDIVIDUAL";

              const workspaceName =
                invitation.workspace_name ||
                (isIndividualWorkspace
                  ? "Individual Workspace"
                  : "Company Workspace");

              const organizationName = invitation.organization_name || "";

              const projectName = invitation.project_name || "";

              const assignedRole = String(
                invitation.role || "USER",
              ).toUpperCase();

              const isThisInvitationProcessing =
                processingInvitationId === String(invitationId);

              const isAccepting =
                isThisInvitationProcessing && processingAction === "accept";

              const isDeclining =
                isThisInvitationProcessing && processingAction === "decline";

              return (
                <article
                  className="zi-invitation-card"
                  key={invitationId ?? `invitation-${index}`}
                >
                  {/* CARD HEADER */}

                  <div className="zi-card-top">
                    <div className="zi-workspace-identity">
                      <div className="zi-workspace-icon">
                        {isIndividualWorkspace ? (
                          <Users size={23} />
                        ) : (
                          <Building2 size={23} />
                        )}
                      </div>

                      <div className="zi-workspace-heading">
                        <span className="zi-card-eyebrow">
                          {isIndividualWorkspace
                            ? "INDIVIDUAL WORKSPACE"
                            : "COMPANY WORKSPACE"}
                        </span>

                        <h3>{workspaceName}</h3>

                        {organizationName &&
                          organizationName !== workspaceName && (
                            <p>{organizationName}</p>
                          )}
                      </div>
                    </div>

                    <div className="zi-pending-badge">
                      <span />
                      PENDING
                    </div>
                  </div>

                  {/* CARD DETAILS */}

                  <div className="zi-card-divider" />

                  <div className="zi-invitation-details">
                    <div className="zi-detail-item">
                      <div className="zi-detail-icon">
                        <ShieldCheck size={17} />
                      </div>

                      <div>
                        <span>INVITED ROLE</span>
                        <strong>{assignedRole}</strong>
                      </div>
                    </div>

                    <div className="zi-detail-item">
                      <div className="zi-detail-icon">
                        <CalendarClock size={17} />
                      </div>

                      <div>
                        <span>INVITATION DATE</span>

                        <strong>{formatDate(invitation.created_at)}</strong>
                      </div>
                    </div>

                    <div className="zi-detail-item">
                      <div className="zi-detail-icon">
                        <Clock3 size={17} />
                      </div>

                      <div>
                        <span>EXPIRES ON</span>

                        <strong>{formatDate(invitation.expires_at)}</strong>
                      </div>
                    </div>

                    {projectName && (
                      <div className="zi-detail-item">
                        <div className="zi-detail-icon">
                          <FolderKanban size={17} />
                        </div>

                        <div>
                          <span>ASSIGNED PROJECT</span>
                          <strong>{projectName}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CARD FOOTER AND ACTIONS */}

                  <div className="zi-card-footer">
                    <div className="zi-card-security">
                      <CheckCircle2 size={15} />

                      <span>Review your assigned role before accepting.</span>
                    </div>

                    <div className="zi-card-actions">
                      <button
                        type="button"
                        className="zi-decline-button"
                        onClick={() => handleDeclineInvitation(invitation)}
                        disabled={!invitationId || isProcessing}
                      >
                        {isDeclining ? (
                          <LoaderCircle
                            size={16}
                            className="zi-refresh-spinning"
                          />
                        ) : (
                          <XCircle size={16} />
                        )}

                        {isDeclining ? "Declining..." : "Decline"}
                      </button>

                      <button
                        type="button"
                        className="zi-accept-button"
                        onClick={() => handleAcceptInvitation(invitation)}
                        disabled={!invitationId || isProcessing}
                      >
                        {isAccepting ? (
                          <LoaderCircle
                            size={16}
                            className="zi-refresh-spinning"
                          />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}

                        {isAccepting ? "Accepting..." : "Accept Invitation"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* PAGE FOOTER */}

      <footer className="zi-page-footer">
        <div>
          <span className="zi-footer-dot" />
          ZYRA
          <span className="zi-footer-divider">/</span>
          WORKSPACE ACCESS
        </div>

        <span>Plan. Collaborate. Build. Evolve.</span>
      </footer>
    </main>
  );
}

export default Invitations;
