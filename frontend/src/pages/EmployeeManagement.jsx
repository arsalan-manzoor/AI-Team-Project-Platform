import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useWorkspace } from "../context/WorkspaceContext";
import { apiRequest } from "../services/api";

import "../styles/EmployeeManagement.css";

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const ROLE_LABELS = {
  ADMIN: "Administrator",
  HR: "HR",
  TEAM_LEADER: "Team Leader",
  USER: "Member",
};

const CREATION_ROLES = {
  ADMIN: ["HR", "TEAM_LEADER", "USER"],
  HR: ["TEAM_LEADER", "USER"],
  TEAM_LEADER: ["USER"],
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function memberName(member) {
  return member?.name || member?.user_name || member?.email || "Employee";
}

function memberRole(member) {
  return String(member?.workspace_role || member?.role || "USER").toUpperCase();
}

function memberStatus(member) {
  return String(member?.account_status || "UNKNOWN").toUpperCase();
}

function initials(name) {
  return String(name || "ZY")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
}

/*
|--------------------------------------------------------------------------
| HR TEAM LEADER ASSIGNMENT HELPERS
|--------------------------------------------------------------------------
*/

function getAssignmentRows(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.assignments)) {
    return response.assignments;
  }

  if (Array.isArray(response?.teamLeaders)) {
    return response.teamLeaders;
  }

  if (Array.isArray(response?.team_leaders)) {
    return response.team_leaders;
  }

  if (Array.isArray(response?.data?.assignments)) {
    return response.data.assignments;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function isActiveAssignedTeamLeader(assignment) {
  const status = String(
    assignment?.team_leader_account_status ??
      assignment?.account_status ??
      assignment?.teamLeaderAccountStatus ??
      assignment?.status ??
      "",
  ).toUpperCase();

  return (
    status === "ACTIVE" &&
    Boolean(
      assignment?.team_leader_user_id ??
      assignment?.teamLeaderUserId ??
      assignment?.user_id ??
      assignment?.userId,
    )
  );
}

/*
|--------------------------------------------------------------------------
| EMPLOYEE MANAGEMENT
|--------------------------------------------------------------------------
*/

export default function EmployeeManagement() {
  const {
    workspaceId,
    workspaceName,
    workspaceType,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const currentRole = String(workspaceRole || "").toUpperCase();

  const roleOptions = useMemo(
    () => CREATION_ROLES[currentRole] || [],
    [currentRole],
  );

  const canManageEmployees =
    workspaceType === "COMPANY" && roleOptions.length > 0;

  const canRemoveMembers =
    workspaceType === "COMPANY" && ["ADMIN", "HR"].includes(currentRole);

  const canUpdateAccountStatus =
    workspaceType === "COMPANY" && currentRole === "ADMIN";

  const canViewOrganizationDirectory = ["ADMIN", "HR"].includes(currentRole);

  /*
  |--------------------------------------------------------------------------
  | STATE
  |--------------------------------------------------------------------------
  */

  const [formMode, setFormMode] = useState("create");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
  });

  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);

  const [directoryError, setDirectoryError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [removingUserId, setRemovingUserId] = useState(null);

  const [updatingStatusUserId, setUpdatingStatusUserId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [createdAccount, setCreatedAccount] = useState(null);

  const [showInitialPassword, setShowInitialPassword] = useState(false);

  const [showFormInitialPassword, setShowFormInitialPassword] = useState(false);

  const [copyMessage, setCopyMessage] = useState("");

  // HR-specific Team Leader assignments.
  const [hrAssignments, setHrAssignments] = useState([]);

  const [hrAssignmentsLoading, setHrAssignmentsLoading] = useState(false);

  const [hrAssignmentsError, setHrAssignmentsError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | CHECK HR TEAM LEADER ASSIGNMENTS
  |--------------------------------------------------------------------------
  */

  const loadHrTeamLeaderAssignments = useCallback(async () => {
    if (
      workspaceLoading ||
      !workspaceId ||
      workspaceType !== "COMPANY" ||
      currentRole !== "HR"
    ) {
      setHrAssignments([]);
      setHrAssignmentsLoading(false);
      return;
    }

    setHrAssignmentsLoading(true);
    setHrAssignmentsError("");

    try {
      const response = await apiRequest(
        `/workspaces/company/${workspaceId}/hr-team-leader-assignments`,
      );

      setHrAssignments(getAssignmentRows(response));
    } catch (requestError) {
      setHrAssignments([]);
      setHrAssignmentsError(
        requestError?.message || "Unable to check your assigned Team Leaders.",
      );
    } finally {
      setHrAssignmentsLoading(false);
    }
  }, [workspaceId, workspaceType, workspaceLoading, currentRole]);

  useEffect(() => {
    void loadHrTeamLeaderAssignments();
  }, [loadHrTeamLeaderAssignments]);

  const hasActiveAssignedTeamLeader = useMemo(
    () => hrAssignments.some(isActiveAssignedTeamLeader),
    [hrAssignments],
  );

  const shouldShowCreateTeamLeader =
    currentRole === "HR" &&
    !hrAssignmentsLoading &&
    !hrAssignmentsError &&
    !hasActiveAssignedTeamLeader;

  /*
  |--------------------------------------------------------------------------
  | LOAD COMPANY MEMBERS
  |--------------------------------------------------------------------------
  */

  const loadMembers = useCallback(async () => {
    if (workspaceLoading) return;

    if (!workspaceId || workspaceType !== "COMPANY") {
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    setMembersLoading(true);
    setDirectoryError("");

    try {
      const endpoint = canViewOrganizationDirectory
        ? `/workspaces/company/${workspaceId}/organization-members`
        : `/workspaces/${workspaceId}/members`;

      const response = await apiRequest(endpoint);

      setMembers(Array.isArray(response?.members) ? response.members : []);
    } catch (requestError) {
      setMembers([]);

      setDirectoryError(
        requestError?.message || "Unable to load company members.",
      );
    } finally {
      setMembersLoading(false);
    }
  }, [
    workspaceId,
    workspaceType,
    workspaceLoading,
    canViewOrganizationDirectory,
  ]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  /*
  |--------------------------------------------------------------------------
  | SEARCH MEMBERS
  |--------------------------------------------------------------------------
  */

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return members;

    return members.filter((member) =>
      [
        memberName(member),
        member?.email,
        memberRole(member),
        memberStatus(member),
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [members, searchQuery]);

  /*
  |--------------------------------------------------------------------------
  | FORM HELPERS
  |--------------------------------------------------------------------------
  */

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function switchMode(mode) {
    setFormMode(mode);

    setError("");
    setSuccess("");

    setCreatedAccount(null);

    setShowInitialPassword(false);
    setShowFormInitialPassword(false);

    setCopyMessage("");

    setForm({
      name: "",
      email: "",
      password: "",
      role: roleOptions[0] || "USER",
    });
  }

  /*
  |--------------------------------------------------------------------------
  | START TEAM LEADER CREATION
  |--------------------------------------------------------------------------
  */

  function startTeamLeaderCreation() {
    setFormMode("create");

    setError("");
    setSuccess("");

    setCreatedAccount(null);

    setShowInitialPassword(false);
    setShowFormInitialPassword(false);

    setCopyMessage("");

    setForm({
      name: "",
      email: "",
      password: "",
      role: "TEAM_LEADER",
    });

    window.setTimeout(() => {
      document
        .querySelector(".zyra-employee-form")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  /*
  |--------------------------------------------------------------------------
  | SEND INVITATION
  |--------------------------------------------------------------------------
  */

  async function sendInvitation(email, role, temporaryPassword = null) {
    const requestBody = {
      email: String(email).trim().toLowerCase(),
      role,
    };

    if (typeof temporaryPassword === "string" && temporaryPassword.length > 0) {
      requestBody.temporaryPassword = temporaryPassword;
    }

    return apiRequest(`/workspaces/company/${workspaceId}/invitations`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE ACCOUNT AND SEND INVITATION
  |--------------------------------------------------------------------------
  */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!workspaceId || !canManageEmployees) {
      setError("You are not allowed to manage employees in this workspace.");
      return;
    }

    const name = form.name.trim();

    const email = form.email.trim().toLowerCase();

    const role = String(form.role).toUpperCase();

    if (!email) {
      setError("Enter the employee's email address.");
      return;
    }

    if (!roleOptions.includes(role)) {
      setError("Choose a role you are permitted to assign.");
      return;
    }

    if (formMode === "create" && name.length < 2) {
      setError("Enter the employee's full name.");
      return;
    }

    if (formMode === "create" && form.password.length < 6) {
      setError("The initial password must contain at least 6 characters.");
      return;
    }

    if (
      formMode === "create" &&
      new TextEncoder().encode(form.password).length > 72
    ) {
      setError("The initial password must not exceed 72 bytes.");
      return;
    }

    setSubmitting(true);

    setError("");
    setSuccess("");
    setCopyMessage("");

    try {
      /*
      |--------------------------------------------------------------------------
      | EXISTING ACCOUNT
      |--------------------------------------------------------------------------
      */

      if (formMode === "existing") {
        await sendInvitation(email, role);

        setSuccess(
          `Invitation sent to ${email}. They join the workspace after accepting it.`,
        );

        setForm({
          name: "",
          email: "",
          password: "",
          role: roleOptions[0] || "USER",
        });

        return;
      }

      /*
      |--------------------------------------------------------------------------
      | STEP 1: CREATE EMPLOYEE ACCOUNT
      |--------------------------------------------------------------------------
      */

      const result = await apiRequest("/users/company-account", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password: form.password,
          role,
          workspaceId,
        }),
      });

      const newAccount = {
        name: result?.account?.name || name,
        email: result?.account?.email || email,
        role,
        password: result?.credentials?.password || form.password,
        invitationSent: false,
      };

      if (!newAccount.password) {
        throw new Error(
          "The employee account was created, but its temporary password is unavailable. Do not recreate the account.",
        );
      }

      setCreatedAccount(newAccount);

      setShowInitialPassword(false);
      setShowFormInitialPassword(false);

      setForm({
        name: "",
        email: "",
        password: "",
        role: roleOptions[0] || "USER",
      });

      /*
      |--------------------------------------------------------------------------
      | STEP 2: SEND COMPANY INVITATION
      |--------------------------------------------------------------------------
      */

      try {
        await sendInvitation(
          newAccount.email,
          newAccount.role,
          newAccount.password,
        );

        setCreatedAccount((current) =>
          current
            ? {
                ...current,
                invitationSent: true,
              }
            : current,
        );

        setSuccess(
          `Account created and invitation sent to ${newAccount.email}.`,
        );

        void loadMembers();
        void loadHrTeamLeaderAssignments();
      } catch (invitationError) {
        setError(
          `The account was created, but invitation delivery failed: ${
            invitationError?.message || "Unknown error"
          }. Use Retry invitation; do not create the account again.`,
        );
      }
    } catch (requestError) {
      setError(requestError?.message || "The employee operation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | RETRY INVITATION
  |--------------------------------------------------------------------------
  */

  async function retryInvitation() {
    if (
      !workspaceId ||
      !createdAccount ||
      createdAccount.invitationSent ||
      submitting
    ) {
      return;
    }

    if (!createdAccount.password) {
      setError(
        "The original temporary password is unavailable. The invitation cannot be retried with incorrect credentials.",
      );
      return;
    }

    setSubmitting(true);

    setError("");
    setSuccess("");

    try {
      await sendInvitation(
        createdAccount.email,
        createdAccount.role,
        createdAccount.password,
      );

      setCreatedAccount((current) =>
        current
          ? {
              ...current,
              invitationSent: true,
            }
          : current,
      );

      setSuccess(`Invitation sent to ${createdAccount.email}.`);

      void loadMembers();
      void loadHrTeamLeaderAssignments();
    } catch (requestError) {
      setError(
        requestError?.message || "The invitation could not be sent. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | COPY INITIAL PASSWORD
  |--------------------------------------------------------------------------
  */

  async function copyInitialPassword() {
    if (!createdAccount?.password) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(createdAccount.password);

      setCopyMessage("Initial password copied.");
    } catch {
      setCopyMessage(
        "Clipboard access is unavailable. Select the password field and copy it manually.",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | REMOVE COMPANY MEMBER
  |--------------------------------------------------------------------------
  */

  async function removeMember(member) {
    const userId = member?.user_id ?? member?.userId;

    const role = memberRole(member);

    const name = memberName(member);

    if (!canRemoveMembers || !userId) {
      setError("This member cannot be removed from this screen.");
      return;
    }

    if (role === "ADMIN") {
      setError("Company administrators cannot be removed here.");
      return;
    }

    if (currentRole === "HR" && role === "HR") {
      setError("HR cannot remove another HR member.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${name} from this company workspace?\n\nTheir ZYRA account will not be deleted.`,
    );

    if (!confirmed) return;

    setRemovingUserId(String(userId));

    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/workspaces/company/${workspaceId}/members/${encodeURIComponent(
          userId,
        )}`,
        {
          method: "DELETE",
        },
      );

      setSuccess(`${name} was removed from the company workspace.`);

      await loadMembers();
      await loadHrTeamLeaderAssignments();
    } catch (requestError) {
      setError(requestError?.message || "The member could not be removed.");
    } finally {
      setRemovingUserId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE EMPLOYEE ACCOUNT STATUS
  |--------------------------------------------------------------------------
  */

  async function updateAccountStatus(member) {
    const userId = member?.user_id ?? member?.userId;

    const role = memberRole(member);

    const name = memberName(member);

    const currentStatus = memberStatus(member);

    if (!canUpdateAccountStatus) {
      setError("Only a Company ADMIN can update employee account status.");
      return;
    }

    if (!userId || role === "ADMIN") {
      setError(
        "This employee account cannot be suspended through this action.",
      );
      return;
    }

    if (!["ACTIVE", "SUSPENDED"].includes(currentStatus)) {
      setError(
        "The employee account status is unavailable. Refresh the directory and try again.",
      );
      return;
    }

    const nextStatus = currentStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

    const actionLabel = nextStatus === "SUSPENDED" ? "suspend" : "reactivate";

    const confirmed = window.confirm(
      `You are about to ${actionLabel} ${name}'s ZYRA account. This changes account access beyond this company workspace and may affect their other ZYRA workspaces. Continue?`,
    );

    if (!confirmed) return;

    setUpdatingStatusUserId(String(userId));

    setError("");
    setSuccess("");

    try {
      const result = await apiRequest(
        `/workspaces/company/${workspaceId}/members/${encodeURIComponent(
          userId,
        )}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            account_status: nextStatus,
          }),
        },
      );

      setSuccess(
        result?.message ||
          `${name}'s account status was changed to ${nextStatus}.`,
      );

      await loadMembers();
      await loadHrTeamLeaderAssignments();
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The employee account status could not be updated.",
      );
    } finally {
      setUpdatingStatusUserId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | WORKSPACE ACCESS CHECKS
  |--------------------------------------------------------------------------
  */

  if (workspaceLoading) {
    return (
      <main className="zyra-employee-page">
        <div className="zyra-employee-state">Loading company workspace...</div>
      </main>
    );
  }

  if (workspaceType !== "COMPANY" || !workspaceId) {
    return (
      <main className="zyra-employee-page">
        <div className="zyra-employee-state">
          Employee Management is available only in an active company workspace.
        </div>
      </main>
    );
  }

  if (!canManageEmployees) {
    return (
      <main className="zyra-employee-page">
        <div className="zyra-employee-state">
          Your company role does not include employee-management access.
        </div>
      </main>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | PAGE UI
  |--------------------------------------------------------------------------
  */

  return (
    <main className="zyra-employee-page">
      {/* PAGE HEADER */}

      <header className="zyra-employee-header">
        <div className="zyra-employee-title">
          <div className="zyra-employee-title-icon">
            <Users size={25} />
          </div>

          <div>
            <p className="zyra-employee-eyebrow">PEOPLE & PERMISSIONS</p>

            <h1>Employee Management</h1>

            <p className="zyra-employee-subtitle">
              {workspaceName || "Company workspace"} · Manage accounts,
              invitations, and members.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="zyra-employee-refresh"
          onClick={() => {
            void loadMembers();
            void loadHrTeamLeaderAssignments();
          }}
          disabled={membersLoading || hrAssignmentsLoading}
        >
          <RefreshCw size={15} />
          Refresh directory
        </button>
      </header>

      {/* MEMBER SUMMARY */}

      <div className="zyra-employee-summary">
        <div className="zyra-employee-summary-icon">
          <Users size={19} />
        </div>

        <div>
          <span>Workspace members</span>

          <strong>{membersLoading ? "…" : members.length}</strong>
        </div>

        <p>Membership starts only after an invitation is accepted.</p>
      </div>

      {/* ERROR */}

      {error && (
        <div
          className="zyra-employee-alert zyra-employee-alert-error"
          role="alert"
        >
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div
          className="zyra-employee-alert zyra-employee-alert-success"
          role="status"
        >
          <CheckCircle2 size={18} />

          <span>{success}</span>

          <button
            type="button"
            aria-label="Dismiss success"
            onClick={() => setSuccess("")}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* NEW ACCOUNT CREDENTIALS */}

      {createdAccount && (
        <section
          className="zyra-created-account"
          aria-label="New employee account result"
        >
          <div className="zyra-created-account-heading">
            <span className="zyra-created-account-icon">
              <ShieldCheck size={20} />
            </span>

            <div>
              <h2>Employee account created</h2>

              <p>
                {createdAccount.name} · {createdAccount.email}
              </p>
            </div>

            <span
              className={
                createdAccount.invitationSent
                  ? "zyra-state-pill zyra-state-sent"
                  : "zyra-state-pill zyra-state-pending"
              }
            >
              {createdAccount.invitationSent
                ? "Invitation sent"
                : "Invitation pending"}
            </span>
          </div>

          <div className="zyra-credential-warning">
            <KeyRound size={17} />

            <p>
              Share the initial password through a secure channel. The employee
              must change it at first login.
            </p>
          </div>

          <div className="zyra-initial-password">
            <label htmlFor="zyra-created-password">Initial password</label>

            <div className="zyra-password-controls">
              <input
                id="zyra-created-password"
                type={showInitialPassword ? "text" : "password"}
                readOnly
                value={createdAccount.password || ""}
                autoComplete="off"
              />

              <button
                type="button"
                onClick={() => setShowInitialPassword((visible) => !visible)}
                aria-label={
                  showInitialPassword ? "Hide password" : "Show password"
                }
                title={showInitialPassword ? "Hide password" : "Show password"}
              >
                {showInitialPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>

              <button
                type="button"
                onClick={() => void copyInitialPassword()}
                aria-label="Copy initial password"
                title="Copy password"
              >
                <Copy size={15} />
                Copy
              </button>
            </div>

            {copyMessage && <small>{copyMessage}</small>}
          </div>

          {!createdAccount.invitationSent && (
            <button
              type="button"
              className="zyra-employee-primary-button zyra-retry-invitation"
              onClick={() => void retryInvitation()}
              disabled={submitting}
            >
              <Mail size={16} />

              {submitting ? "Sending invitation..." : "Retry invitation"}
            </button>
          )}

          <button
            type="button"
            className="zyra-credential-dismiss"
            onClick={() => {
              setCreatedAccount(null);
              setShowInitialPassword(false);
              setShowFormInitialPassword(false);
              setCopyMessage("");
            }}
          >
            Dismiss credential display
          </button>

          <p className="zyra-created-account-footnote">
            The employee appears in the workspace directory after accepting the
            invitation.
          </p>
        </section>
      )}

      {/* ADD EMPLOYEE */}

      <section className="zyra-employee-panel">
        <div className="zyra-employee-panel-heading">
          <div>
            <span className="zyra-employee-eyebrow">ACCOUNT WORKFLOW</span>

            <h2>Add an employee</h2>

            <p>Create a new ZYRA account or invite an existing account.</p>
          </div>

          <div
            className="zyra-employee-mode-switch"
            aria-label="Employee account mode"
          >
            <button
              type="button"
              className={formMode === "create" ? "active" : ""}
              onClick={() => switchMode("create")}
            >
              <UserPlus size={15} />
              New account
            </button>

            <button
              type="button"
              className={formMode === "existing" ? "active" : ""}
              onClick={() => switchMode("existing")}
            >
              <Mail size={15} />
              Existing account
            </button>
          </div>
        </div>

        {/* HR TEAM LEADER CREATION PROMPT */}

        {currentRole === "HR" && hrAssignmentsLoading && (
          <div className="zyra-employee-directory-error">
            <RefreshCw size={16} />
            <span>Checking your assigned Team Leaders...</span>
          </div>
        )}

        {currentRole === "HR" && hrAssignmentsError && (
          <div className="zyra-employee-directory-error" role="alert">
            <AlertCircle size={16} />

            <span>{hrAssignmentsError}</span>

            <button
              type="button"
              onClick={() => void loadHrTeamLeaderAssignments()}
            >
              Retry
            </button>
          </div>
        )}

        {shouldShowCreateTeamLeader && (
          <div className="zyra-create-team-leader-prompt">
            <div>
              <strong>No active Team Leader assigned to you</strong>

              <p>
                Create a Team Leader account to help manage your projects and
                teams. They can join your workspace after accepting the
                invitation.
              </p>
            </div>

            <button
              type="button"
              className="zyra-employee-primary-button"
              onClick={startTeamLeaderCreation}
            >
              <UserPlus size={16} />
              Create Team Leader
            </button>
          </div>
        )}

        <form className="zyra-employee-form" onSubmit={handleSubmit}>
          {formMode === "create" && (
            <label className="zyra-employee-field">
              <span>Employee full name</span>

              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
              />
            </label>
          )}

          <label className="zyra-employee-field">
            <span>
              {formMode === "create"
                ? "Employee email address"
                : "Existing ZYRA account email"}
            </span>

            <input
              type="email"
              required
              autoComplete="email"
              placeholder="employee@company.com"
              value={form.email}
              onChange={(event) => updateForm("email", event.target.value)}
            />
          </label>

          {formMode === "create" && (
            <label className="zyra-employee-field">
              <span>Initial password</span>

              <div className="zyra-password-controls">
                <input
                  type={showFormInitialPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowFormInitialPassword((visible) => !visible)
                  }
                  aria-label={
                    showFormInitialPassword
                      ? "Hide initial password"
                      : "Show initial password"
                  }
                  title={
                    showFormInitialPassword ? "Hide password" : "Show password"
                  }
                >
                  {showFormInitialPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>

              <small>
                The employee must change this password at first login.
              </small>
            </label>
          )}

          <label className="zyra-employee-field">
            <span>Workspace role</span>

            <select
              value={form.role}
              onChange={(event) => updateForm("role", event.target.value)}
              required
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>

            <small>
              Available roles depend on your company role. The server remains
              authoritative.
            </small>
          </label>

          <div className="zyra-employee-form-footer">
            <p>
              {formMode === "create"
                ? "An account is created first, then an invitation is emailed. Membership begins after acceptance."
                : "The email must belong to an existing active ZYRA account not already in this workspace."}
            </p>

            <button
              type="submit"
              className="zyra-employee-primary-button"
              disabled={submitting}
            >
              {submitting ? (
                <RefreshCw size={16} />
              ) : formMode === "create" ? (
                <Plus size={17} />
              ) : (
                <Mail size={16} />
              )}

              {submitting
                ? "Processing..."
                : formMode === "create"
                  ? "Create account & invite"
                  : "Send invitation"}
            </button>
          </div>
        </form>
      </section>

      {/* EMPLOYEE DIRECTORY */}

      <section className="zyra-employee-panel zyra-member-directory">
        <div className="zyra-employee-panel-heading zyra-directory-heading">
          <div>
            <span className="zyra-employee-eyebrow">COMPANY WORKSPACE</span>

            <h2>Employee directory</h2>

            <p>Current members, workspace roles, and account status.</p>
          </div>

          <div className="zyra-directory-total">
            <strong>{membersLoading ? "…" : filteredMembers.length}</strong>

            <span>{searchQuery.trim() ? "matching" : "members"}</span>
          </div>
        </div>

        {/* SEARCH */}

        <label className="zyra-employee-search">
          <Search size={17} />

          <input
            type="search"
            aria-label="Search employees"
            placeholder="Search by name, email, role, or status..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
            >
              <X size={15} />
            </button>
          )}
        </label>

        {/* DIRECTORY ERROR */}

        {directoryError && (
          <div className="zyra-employee-directory-error" role="alert">
            <AlertCircle size={16} />

            <span>{directoryError}</span>

            <button type="button" onClick={() => void loadMembers()}>
              Retry
            </button>
          </div>
        )}

        {/* MEMBER TABLE */}

        <div className="zyra-employee-table-wrap">
          <table className="zyra-employee-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Workspace role</th>
                <th>Account status</th>

                {canRemoveMembers && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {membersLoading ? (
                <tr>
                  <td
                    colSpan={canRemoveMembers ? 4 : 3}
                    className="zyra-employee-empty"
                  >
                    Loading employee directory...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td
                    colSpan={canRemoveMembers ? 4 : 3}
                    className="zyra-employee-empty"
                  >
                    {searchQuery.trim()
                      ? "No employees match your search."
                      : "No members were returned for this workspace."}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const role = memberRole(member);

                  const status = memberStatus(member);

                  const userId = member?.user_id ?? member?.userId;

                  const name = memberName(member);

                  const blocked =
                    role === "ADMIN" ||
                    (currentRole === "HR" && role === "HR") ||
                    !userId;

                  return (
                    <tr
                      key={`${member.user_id ?? member.userId ?? member.id}-${member.workspace_membership_id ?? ""}`}
                    >
                      <td>
                        <div className="zyra-directory-member">
                          <span className="zyra-directory-avatar">
                            {initials(name)}
                          </span>

                          <span>
                            <strong>{name}</strong>

                            <small>{member.email || "Email unavailable"}</small>
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`zyra-employee-role zyra-role-${role.toLowerCase()}`}
                        >
                          {ROLE_LABELS[role] || role}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`zyra-employee-status zyra-status-${status.toLowerCase()}`}
                        >
                          <i />

                          {status === "UNKNOWN"
                            ? "Unknown"
                            : status.charAt(0) + status.slice(1).toLowerCase()}
                        </span>
                      </td>

                      {canRemoveMembers && (
                        <td>
                          <div className="zyra-member-actions">
                            {blocked ? (
                              <span className="zyra-member-protected">
                                <ShieldCheck size={14} />
                                Protected
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="zyra-member-remove"
                                disabled={removingUserId === String(userId)}
                                onClick={() => void removeMember(member)}
                                aria-label={`Remove ${name} from workspace`}
                              >
                                <Trash2 size={14} />

                                {removingUserId === String(userId)
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            )}

                            {canUpdateAccountStatus &&
                              role !== "ADMIN" &&
                              userId && (
                                <button
                                  type="button"
                                  className={
                                    status === "SUSPENDED"
                                      ? "zyra-member-activate"
                                      : "zyra-member-suspend"
                                  }
                                  disabled={
                                    updatingStatusUserId === String(userId) ||
                                    !["ACTIVE", "SUSPENDED"].includes(status)
                                  }
                                  onClick={() =>
                                    void updateAccountStatus(member)
                                  }
                                  aria-label={`${
                                    status === "SUSPENDED"
                                      ? "Activate"
                                      : "Suspend"
                                  } ${name}`}
                                >
                                  {updatingStatusUserId === String(userId) ? (
                                    <RefreshCw size={14} />
                                  ) : status === "SUSPENDED" ? (
                                    <CheckCircle2 size={14} />
                                  ) : (
                                    <ShieldCheck size={14} />
                                  )}

                                  {updatingStatusUserId === String(userId)
                                    ? "Updating..."
                                    : status === "SUSPENDED"
                                      ? "Activate"
                                      : "Suspend"}
                                </button>
                              )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="zyra-directory-note">
          <ShieldCheck size={16} />

          <p>
            Removing a member does not delete their ZYRA account. The backend
            checks permissions for every operation.
          </p>
        </div>
      </section>
    </main>
  );
}
