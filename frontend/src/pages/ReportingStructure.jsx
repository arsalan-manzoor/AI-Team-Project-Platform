import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";

import { useWorkspace } from "../context/WorkspaceContext";
import { apiRequest } from "../services/api";

import "../styles/reporting-structure.css";

// ============================================================
// HELPERS
// ============================================================

function personName(person) {
  return person?.name || person?.user_name || person?.email || "ZYRA Member";
}

function personRole(person) {
  return String(person?.role || "USER").toUpperCase();
}

function initials(name) {
  return String(name || "ZY")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
// ============================================================
// ROLE BADGE
// ============================================================

function RoleBadge({ role }) {
  const normalizedRole = String(role || "USER").toUpperCase();

  const roleLabels = {
    ADMIN: "ADMIN",
    HR: "HR",
    TEAM_LEADER: "TEAM LEADER",
    USER: "USER",
  };

  const roleClasses = {
    ADMIN: "admin",
    HR: "hr",
    TEAM_LEADER: "leader",
    USER: "user",
  };

  return (
    <span
      className={`rpt-inline-role rpt-inline-role-${
        roleClasses[normalizedRole] || "user"
      }`}
    >
      {roleLabels[normalizedRole] || "MEMBER"}
    </span>
  );
}
function formatRole(role) {
  const roles = {
    ADMIN: "Administrator",
    HR: "Human Resources",
    TEAM_LEADER: "Team Leader",
    USER: "Team Member",
  };

  return roles[String(role || "").toUpperCase()] || role || "Member";
}

function isPersonMatch(person, query) {
  if (!query) {
    return true;
  }

  const searchable = [
    person?.name,
    person?.email,
    person?.role,
    person?.account_status,
    person?.user_id,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

function filterLeader(leader, query) {
  if (!query || isPersonMatch(leader, query)) {
    return leader;
  }

  const matchingUsers = (leader.users || []).filter((user) =>
    isPersonMatch(user, query),
  );

  if (matchingUsers.length === 0) {
    return null;
  }

  return {
    ...leader,
    users: matchingUsers,
    user_count: matchingUsers.length,
  };
}

function filterHr(hr, query) {
  if (!query || isPersonMatch(hr, query)) {
    return hr;
  }

  const matchingLeaders = (hr.team_leaders || [])
    .map((leader) => filterLeader(leader, query))
    .filter(Boolean);

  if (matchingLeaders.length === 0) {
    return null;
  }

  return {
    ...hr,
    team_leaders: matchingLeaders,
    team_leader_count: matchingLeaders.length,
    user_count: matchingLeaders.reduce(
      (total, leader) => total + (leader.users || []).length,
      0,
    ),
  };
}

// ============================================================
// AVATAR
// ============================================================

function PersonAvatar({ name, role }) {
  const normalizedRole = String(role || "").toUpperCase();

  const avatarClass =
    normalizedRole === "HR"
      ? "rpt-avatar rpt-avatar-hr"
      : normalizedRole === "TEAM_LEADER"
        ? "rpt-avatar rpt-avatar-leader"
        : normalizedRole === "ADMIN"
          ? "rpt-avatar rpt-avatar-admin"
          : "rpt-avatar rpt-avatar-user";

  return (
    <div className={avatarClass} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }) {
  const normalizedStatus = String(status || "UNKNOWN").toUpperCase();

  const className =
    normalizedStatus === "ACTIVE"
      ? "rpt-status rpt-status-active"
      : "rpt-status rpt-status-inactive";

  return (
    <span className={className}>
      <span className="rpt-status-dot" />
      {normalizedStatus}
    </span>
  );
}

// ============================================================
// USER CARD
// ============================================================

function UserCard({ user }) {
  return (
    <div className="rpt-user-card">
      <PersonAvatar name={personName(user)} role="USER" />

      <div className="rpt-person-details">
        <div className="rpt-person-name-row">
          <strong>{personName(user)}</strong>
          <RoleBadge role={personRole(user)} />
        </div>

        <span>{user.email || "No email available"}</span>
        <div className="rpt-person-mobile-meta">
          <StatusBadge status={user.account_status} />
        </div>
      </div>

      <div className="rpt-user-status">
        <StatusBadge status={user.account_status} />
      </div>
    </div>
  );
}

// ============================================================
// TEAM LEADER NODE
// ============================================================

function TeamLeaderNode({ leader, expanded, onToggle }) {
  const users = leader.users || [];

  return (
    <article className="rpt-leader-node">
      <button
        type="button"
        className="rpt-node-header rpt-leader-header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="rpt-node-identity">
          <PersonAvatar name={personName(leader)} role="TEAM_LEADER" />

          <div className="rpt-person-details">
            <div className="rpt-person-name-row">
              <strong>{personName(leader)}</strong>
              <RoleBadge role={personRole(leader)} />
            </div>

            <span>{leader.email || "No email available"}</span>

            <div className="rpt-person-mobile-meta">
              <StatusBadge status={leader.account_status} />
            </div>
          </div>
        </div>

        <div className="rpt-node-meta">
          <span className="rpt-count-pill">
            <Users size={14} />
            {users.length} {users.length === 1 ? "User" : "Users"}
          </span>

          <span className="rpt-chevron">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="rpt-user-children">
          {users.length > 0 ? (
            users.map((user) => <UserCard key={user.user_id} user={user} />)
          ) : (
            <div className="rpt-empty-children">
              <UserRound size={19} />

              <div>
                <strong>No Users assigned yet</strong>

                <span>
                  Employees assigned to this Team Leader will appear here.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// HR NODE
// ============================================================

function HrNode({ hr, expanded, expandedLeaders, onToggleHr, onToggleLeader }) {
  const teamLeaders = hr.team_leaders || [];

  return (
    <article className="rpt-hr-node">
      <button
        type="button"
        className="rpt-node-header rpt-hr-header"
        onClick={onToggleHr}
        aria-expanded={expanded}
      >
        <div className="rpt-node-identity">
          <PersonAvatar name={personName(hr)} role="HR" />

          <div className="rpt-person-details">
            <div className="rpt-person-name-row">
              <strong>{personName(hr)}</strong>
              <RoleBadge role={personRole(hr)} />
            </div>

            <span>{hr.email || "No email available"}</span>
            <div className="rpt-person-mobile-meta">
              <StatusBadge status={hr.account_status} />
            </div>
          </div>
        </div>

        <div className="rpt-node-meta">
          <span className="rpt-count-pill">
            <Users size={14} />
            {teamLeaders.length}{" "}
            {teamLeaders.length === 1 ? "Leader" : "Leaders"}
          </span>

          <span className="rpt-chevron">
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="rpt-leader-children">
          {teamLeaders.length > 0 ? (
            teamLeaders.map((leader) => (
              <TeamLeaderNode
                key={leader.user_id}
                leader={leader}
                expanded={expandedLeaders.has(Number(leader.user_id))}
                onToggle={() => onToggleLeader(leader.user_id)}
              />
            ))
          ) : (
            <div className="rpt-empty-children">
              <Users size={19} />

              <div>
                <strong>No Team Leaders assigned</strong>

                <span>Team Leaders assigned to this HR will appear here.</span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// REPORTING STRUCTURE PAGE
// ============================================================

export default function ReportingStructure() {
  const {
    activeWorkspace,
    workspaceId,
    workspaceName,
    workspaceType: contextWorkspaceType,
    workspaceRole: contextWorkspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const effectiveWorkspaceType = String(
    contextWorkspaceType ||
      activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      "",
  )
    .trim()
    .toUpperCase();

  const effectiveWorkspaceRole = String(
    contextWorkspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  // ==========================================================
  // STATE
  // ==========================================================

  const [structure, setStructure] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [expandedHrs, setExpandedHrs] = useState(new Set());
  const [expandedLeaders, setExpandedLeaders] = useState(new Set());

  const [selectedLeaderId, setSelectedLeaderId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [savingAssignment, setSavingAssignment] = useState(false);

  // ==========================================================
  // LOAD REPORTING STRUCTURE
  // ==========================================================

  const loadStructure = useCallback(async () => {
    if (workspaceLoading) {
      return;
    }

    if (!workspaceId) {
      setStructure(null);
      setError("No active workspace was found for this account.");
      setLoading(false);
      return;
    }

    if (effectiveWorkspaceType !== "COMPANY") {
      setStructure(null);
      setError(
        "The Reporting Structure page is available only inside a Company workspace.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiRequest(
        `/workspaces/company/${encodeURIComponent(workspaceId)}/reporting-structure`,
      );

      const result = response?.data ?? response;

      setStructure(result);

      setExpandedHrs(
        new Set((result?.hierarchy || []).map((hr) => Number(hr.user_id))),
      );

      const leaderIds = [];

      for (const hr of result?.hierarchy || []) {
        for (const leader of hr.team_leaders || []) {
          leaderIds.push(Number(leader.user_id));
        }
      }

      for (const leader of result?.unassigned_team_leaders || []) {
        leaderIds.push(Number(leader.user_id));
      }

      if (result?.my_team_leader?.user_id) {
        leaderIds.push(Number(result.my_team_leader.user_id));
      }

      setExpandedLeaders(new Set(leaderIds));
    } catch (requestError) {
      setStructure(null);

      setError(
        requestError?.message ||
          "Unable to load the Company reporting structure.",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, effectiveWorkspaceType, workspaceLoading]);

  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);

  // ==========================================================
  // ROLE
  // ==========================================================

  const viewerRole = String(
    structure?.viewer_role || effectiveWorkspaceRole || "",
  ).toUpperCase();

  const canViewStructure = ["ADMIN", "HR", "TEAM_LEADER"].includes(viewerRole);

  // ==========================================================
  // COLLECT ALL TEAM LEADERS
  // ==========================================================

  const allLeaders = useMemo(() => {
    const leadersById = new Map();

    function addLeader(leader) {
      if (!leader?.user_id) {
        return;
      }

      leadersById.set(Number(leader.user_id), leader);
    }

    for (const hr of structure?.hierarchy || []) {
      for (const leader of hr.team_leaders || []) {
        addLeader(leader);
      }
    }

    for (const leader of structure?.unassigned_team_leaders || []) {
      addLeader(leader);
    }

    if (structure?.my_team_leader) {
      addLeader(structure.my_team_leader);
    }

    return [...leadersById.values()].sort((a, b) =>
      personName(a).localeCompare(personName(b)),
    );
  }, [structure]);

  // ==========================================================
  // COLLECT ALL USERS VISIBLE TO THE ADMIN
  //
  // This list supports selecting a User for assignment or
  // reassignment without changing any existing membership.
  // ==========================================================

  const allUsers = useMemo(() => {
    const usersById = new Map();

    function addUser(user, leader = null) {
      if (!user?.user_id) {
        return;
      }

      const id = Number(user.user_id);

      if (usersById.has(id)) {
        return;
      }

      usersById.set(id, {
        ...user,
        user_id: id,
        assigned_team_leader_id: leader ? Number(leader.user_id) : null,
        assigned_team_leader_name: leader ? personName(leader) : null,
      });
    }

    function collectLeaderUsers(leader) {
      for (const user of leader.users || []) {
        addUser(user, leader);
      }
    }

    for (const hr of structure?.hierarchy || []) {
      for (const leader of hr.team_leaders || []) {
        collectLeaderUsers(leader);
      }
    }

    for (const leader of structure?.unassigned_team_leaders || []) {
      collectLeaderUsers(leader);
    }

    if (structure?.my_team_leader) {
      collectLeaderUsers(structure.my_team_leader);
    }

    for (const user of structure?.unassigned_users || []) {
      addUser(user);
    }

    return [...usersById.values()].sort((a, b) =>
      personName(a).localeCompare(personName(b)),
    );
  }, [structure]);

  // ==========================================================
  // ASSIGNMENT FORM DEFAULTS
  // ==========================================================

  useEffect(() => {
    if (allLeaders.length === 0) {
      setSelectedLeaderId("");
      return;
    }

    setSelectedLeaderId((current) => {
      const exists = allLeaders.some(
        (leader) => String(leader.user_id) === current,
      );

      return exists ? current : String(allLeaders[0].user_id);
    });
  }, [allLeaders]);

  useEffect(() => {
    if (allUsers.length === 0) {
      setSelectedUserId("");
      return;
    }

    setSelectedUserId((current) => {
      const exists = allUsers.some((user) => String(user.user_id) === current);

      return exists ? current : String(allUsers[0].user_id);
    });
  }, [allUsers]);

  // ==========================================================
  // EXPAND / COLLAPSE
  // ==========================================================

  function toggleHr(hrId) {
    const normalizedId = Number(hrId);

    setExpandedHrs((previous) => {
      const next = new Set(previous);

      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }

      return next;
    });
  }

  function toggleLeader(leaderId) {
    const normalizedId = Number(leaderId);

    setExpandedLeaders((previous) => {
      const next = new Set(previous);

      if (next.has(normalizedId)) {
        next.delete(normalizedId);
      } else {
        next.add(normalizedId);
      }

      return next;
    });
  }

  function expandAll() {
    setExpandedHrs(
      new Set((structure?.hierarchy || []).map((hr) => Number(hr.user_id))),
    );

    setExpandedLeaders(
      new Set(allLeaders.map((leader) => Number(leader.user_id))),
    );
  }

  function collapseAll() {
    setExpandedHrs(new Set());
    setExpandedLeaders(new Set());
  }

  // ==========================================================
  // ASSIGN USER TO TEAM LEADER
  //
  // This first UI version enables assignment management for
  // ADMIN. HR and Team Leader retain their scoped views.
  // ==========================================================

  async function handleAssignUser(event) {
    event.preventDefault();

    if (viewerRole !== "ADMIN") {
      setError("Only a Company Admin can manage assignments from this panel.");
      return;
    }

    if (!selectedLeaderId || !selectedUserId) {
      setError("Select both a Team Leader and a User.");
      return;
    }

    const selectedLeader = allLeaders.find(
      (leader) => Number(leader.user_id) === Number(selectedLeaderId),
    );

    const selectedUser = allUsers.find(
      (user) => Number(user.user_id) === Number(selectedUserId),
    );

    if (!selectedLeader || !selectedUser) {
      setError(
        "The selected Team Leader or User is not available in this workspace.",
      );
      return;
    }

    if (selectedLeader.account_status !== "ACTIVE") {
      setError("The selected Team Leader account is not active.");
      return;
    }

    if (selectedUser.account_status !== "ACTIVE") {
      setError("The selected User account is not active.");
      return;
    }

    setSavingAssignment(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest(
        `/workspaces/company/${encodeURIComponent(workspaceId)}/team-leader-user-assignments`,
        {
          method: "POST",
          body: JSON.stringify({
            teamLeaderUserId: Number(selectedLeaderId),
            userId: Number(selectedUserId),
          }),
        },
      );

      setSuccess(
        response?.message ||
          `Successfully assigned ${personName(selectedUser)} to ${personName(selectedLeader)}.`,
      );

      await loadStructure();
    } catch (requestError) {
      setError(
        requestError?.message || "Unable to update the User assignment.",
      );
    } finally {
      setSavingAssignment(false);
    }
  }

  // ==========================================================
  // FILTERED DATA
  // ==========================================================

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredHierarchy = useMemo(
    () =>
      (structure?.hierarchy || [])
        .map((hr) => filterHr(hr, normalizedSearch))
        .filter(Boolean),
    [structure, normalizedSearch],
  );

  const filteredUnassignedLeaders = useMemo(
    () =>
      (structure?.unassigned_team_leaders || [])
        .map((leader) => filterLeader(leader, normalizedSearch))
        .filter(Boolean),
    [structure, normalizedSearch],
  );

  const filteredUnassignedUsers = useMemo(
    () =>
      (structure?.unassigned_users || []).filter((user) =>
        isPersonMatch(user, normalizedSearch),
      ),
    [structure, normalizedSearch],
  );

  const filteredMyTeamLeader = useMemo(
    () =>
      structure?.my_team_leader
        ? filterLeader(structure.my_team_leader, normalizedSearch)
        : null,
    [structure, normalizedSearch],
  );

  const counts = structure?.counts || {};

  const companyDisplayName =
    structure?.company?.organization_name ||
    structure?.company?.workspace_name ||
    workspaceName ||
    activeWorkspace?.name ||
    "Company Workspace";

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <main className="zyra-reporting-page">
      <div className="rpt-page-header">
        <div className="rpt-heading-copy">
          <div className="rpt-eyebrow">
            <span className="rpt-eyebrow-dot" />
            ZYRA / ORGANIZATION INTELLIGENCE
          </div>

          <h1>
            Reporting <span>Structure</span>
          </h1>

          <p>
            See how your people connect across HR, Team Leaders, and members.
          </p>
        </div>

        <button
          type="button"
          className="rpt-refresh-button"
          onClick={() => void loadStructure()}
          disabled={loading || workspaceLoading}
        >
          <RefreshCw size={16} className={loading ? "rpt-spin" : ""} />
          Refresh
        </button>
      </div>

      <section className="rpt-company-banner">
        <div className="rpt-company-icon">
          <Building2 size={21} />
        </div>

        <div className="rpt-company-copy">
          <span>ACTIVE COMPANY WORKSPACE</span>
          <strong>{companyDisplayName}</strong>
        </div>

        <div className="rpt-viewer-badge">
          <ShieldCheck size={15} />
          {formatRole(viewerRole)}
        </div>
      </section>

      {error && (
        <div className="rpt-message rpt-message-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rpt-message rpt-message-success" role="status">
          <CheckCircle2 size={19} />
          <span>{success}</span>

          <button
            type="button"
            aria-label="Dismiss success message"
            onClick={() => setSuccess("")}
          >
            <XCircle size={17} />
          </button>
        </div>
      )}

      {loading || workspaceLoading ? (
        <div className="rpt-loading-card">
          <div className="rpt-loading-icon">
            <LoaderCircle size={28} className="rpt-spin" />
          </div>

          <h2>Loading reporting structure</h2>

          <p>Connecting your company hierarchy and employee assignments.</p>

          <div className="rpt-loading-track">
            <span />
          </div>
        </div>
      ) : structure && !canViewStructure ? (
        <div className="rpt-empty-page">
          <ShieldCheck size={30} />

          <h2>Restricted access</h2>

          <p>This page is available to Company Admins, HR, and Team Leaders.</p>
        </div>
      ) : structure ? (
        <>
          {/* ==================================================
              METRICS
          ================================================== */}

          <section className="rpt-stats-grid" aria-label="Reporting statistics">
            <article className="rpt-stat-card">
              <div className="rpt-stat-top">
                <span>HR</span>

                <div className="rpt-stat-icon rpt-stat-icon-purple">
                  <ShieldCheck size={18} />
                </div>
              </div>

              <strong>{counts.hr ?? 0}</strong>

              <span className="rpt-stat-caption">
                {viewerRole === "ADMIN"
                  ? "People operations"
                  : "Visible HR structure"}
              </span>
            </article>

            <article className="rpt-stat-card">
              <div className="rpt-stat-top">
                <span>Team Leaders</span>

                <div className="rpt-stat-icon rpt-stat-icon-cyan">
                  <GitBranch size={18} />
                </div>
              </div>

              <strong>{counts.team_leaders ?? 0}</strong>

              <span className="rpt-stat-caption">Leaders in this view</span>
            </article>

            <article className="rpt-stat-card">
              <div className="rpt-stat-top">
                <span>Users</span>

                <div className="rpt-stat-icon rpt-stat-icon-blue">
                  <Users size={18} />
                </div>
              </div>

              <strong>{counts.users ?? 0}</strong>

              <span className="rpt-stat-caption">Visible team members</span>
            </article>

            {viewerRole === "ADMIN" && (
              <article className="rpt-stat-card">
                <div className="rpt-stat-top">
                  <span>Unassigned Users</span>

                  <div className="rpt-stat-icon rpt-stat-icon-amber">
                    <UserPlus size={18} />
                  </div>
                </div>

                <strong>{counts.unassigned_users ?? 0}</strong>

                <span className="rpt-stat-caption">Need a Team Leader</span>
              </article>
            )}
          </section>

          {/* ==================================================
              ADMIN ASSIGNMENT PANEL
          ================================================== */}

          {viewerRole === "ADMIN" && (
            <section className="rpt-assignment-panel">
              <div className="rpt-section-heading">
                <div>
                  <span className="rpt-section-kicker">PEOPLE MANAGEMENT</span>

                  <h2>Assign a User</h2>

                  <p>
                    Assign or reassign an active User to a Team Leader in this
                    company.
                  </p>
                </div>

                <div className="rpt-assignment-heading-icon">
                  <UserPlus size={21} />
                </div>
              </div>

              {allLeaders.length === 0 || allUsers.length === 0 ? (
                <div className="rpt-inline-empty">
                  <Users size={19} />

                  <span>
                    You need at least one Team Leader and one User in this
                    company before an assignment can be made.
                  </span>
                </div>
              ) : (
                <form
                  className="rpt-assignment-form"
                  onSubmit={handleAssignUser}
                >
                  <label className="rpt-field">
                    <span>Team Leader</span>

                    <select
                      value={selectedLeaderId}
                      onChange={(event) =>
                        setSelectedLeaderId(event.target.value)
                      }
                      required
                    >
                      {allLeaders.map((leader) => (
                        <option
                          key={leader.user_id}
                          value={leader.user_id}
                          disabled={leader.account_status !== "ACTIVE"}
                        >
                          {personName(leader)} · ID {leader.user_id}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rpt-field">
                    <span>User</span>

                    <select
                      value={selectedUserId}
                      onChange={(event) =>
                        setSelectedUserId(event.target.value)
                      }
                      required
                    >
                      {allUsers.map((user) => {
                        let assignmentText = "Unassigned";

                        if (user.assigned_team_leader_name) {
                          assignmentText = `Currently: ${user.assigned_team_leader_name}`;
                        }

                        return (
                          <option
                            key={user.user_id}
                            value={user.user_id}
                            disabled={user.account_status !== "ACTIVE"}
                          >
                            {personName(user)} · {assignmentText}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <button
                    type="submit"
                    className="rpt-assign-button"
                    disabled={
                      savingAssignment || !selectedLeaderId || !selectedUserId
                    }
                  >
                    {savingAssignment ? (
                      <LoaderCircle size={17} className="rpt-spin" />
                    ) : (
                      <UserPlus size={17} />
                    )}

                    {savingAssignment ? "Saving..." : "Save Assignment"}
                  </button>
                </form>
              )}

              <div className="rpt-assignment-note">
                <ShieldCheck size={15} />

                <span>
                  The backend validates every assignment and prevents invalid
                  role relationships.
                </span>
              </div>
            </section>
          )}

          {/* ==================================================
              SEARCH AND CONTROLS
          ================================================== */}

          <section className="rpt-structure-section">
            <div className="rpt-structure-toolbar">
              <div className="rpt-section-heading rpt-structure-title">
                <div>
                  <span className="rpt-section-kicker">ORGANIZATION MAP</span>

                  <h2>People &amp; reporting lines</h2>

                  <p>
                    Expand each level to inspect the reporting relationships.
                  </p>
                </div>
              </div>

              <div className="rpt-tree-controls">
                <button type="button" onClick={expandAll}>
                  Expand all
                </button>

                <button type="button" onClick={collapseAll}>
                  Collapse all
                </button>
              </div>
            </div>

            <div className="rpt-search">
              <Search size={18} />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by name, email, role, or User ID..."
                aria-label="Search reporting structure"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <XCircle size={17} />
                </button>
              )}
            </div>

            {/* ================================================
                ADMIN / HR HIERARCHY
            ================================================ */}

            {(viewerRole === "ADMIN" || viewerRole === "HR") && (
              <div className="rpt-hierarchy">
                {filteredHierarchy.length > 0 ? (
                  filteredHierarchy.map((hr) => (
                    <HrNode
                      key={hr.user_id}
                      hr={hr}
                      expanded={expandedHrs.has(Number(hr.user_id))}
                      expandedLeaders={expandedLeaders}
                      onToggleHr={() => toggleHr(hr.user_id)}
                      onToggleLeader={toggleLeader}
                    />
                  ))
                ) : (
                  <div className="rpt-empty-page">
                    <Users size={29} />

                    <h3>No matching reporting lines</h3>

                    <p>Try another search term or clear the search.</p>
                  </div>
                )}
              </div>
            )}

            {/* ================================================
                TEAM LEADER VIEW
            ================================================ */}

            {viewerRole === "TEAM_LEADER" && (
              <div className="rpt-hierarchy">
                {filteredMyTeamLeader ? (
                  <TeamLeaderNode
                    leader={filteredMyTeamLeader}
                    expanded={expandedLeaders.has(
                      Number(filteredMyTeamLeader.user_id),
                    )}
                    onToggle={() => toggleLeader(filteredMyTeamLeader.user_id)}
                  />
                ) : (
                  <div className="rpt-empty-page">
                    <Users size={29} />

                    <h3>No matching team members</h3>

                    <p>
                      Your assigned Users will appear here when they match the
                      selected search.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ================================================
                ADMIN: TEAM LEADERS WITHOUT HR ASSIGNMENT
            ================================================ */}

            {viewerRole === "ADMIN" && (
              <section className="rpt-unassigned-section">
                <div className="rpt-subsection-header">
                  <div>
                    <span className="rpt-section-kicker">
                      UNASSIGNED REPORTING
                    </span>

                    <h3>Team Leaders without an HR</h3>

                    <p>
                      These Team Leaders do not currently report to an HR in
                      this organization.
                    </p>
                  </div>

                  <span className="rpt-count-pill">
                    {filteredUnassignedLeaders.length}
                  </span>
                </div>

                {filteredUnassignedLeaders.length > 0 ? (
                  <div className="rpt-unassigned-list">
                    {filteredUnassignedLeaders.map((leader) => (
                      <TeamLeaderNode
                        key={leader.user_id}
                        leader={leader}
                        expanded={expandedLeaders.has(Number(leader.user_id))}
                        onToggle={() => toggleLeader(leader.user_id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rpt-compact-empty">
                    <CheckCircle2 size={17} />

                    <span>
                      All Team Leaders are assigned to an HR, or no matching
                      Team Leaders were found.
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* ================================================
                ADMIN: USERS WITHOUT A TEAM LEADER
            ================================================ */}

            {viewerRole === "ADMIN" && (
              <section className="rpt-unassigned-section">
                <div className="rpt-subsection-header">
                  <div>
                    <span className="rpt-section-kicker">ACTION REQUIRED</span>

                    <h3>Users without a Team Leader</h3>

                    <p>
                      Assign these employees to a Team Leader using the
                      assignment panel above.
                    </p>
                  </div>

                  <span className="rpt-count-pill rpt-count-pill-warning">
                    {filteredUnassignedUsers.length}
                  </span>
                </div>

                {filteredUnassignedUsers.length > 0 ? (
                  <div className="rpt-unassigned-users">
                    {filteredUnassignedUsers.map((user) => (
                      <UserCard key={user.user_id} user={user} />
                    ))}
                  </div>
                ) : (
                  <div className="rpt-compact-empty">
                    <CheckCircle2 size={17} />

                    <span>No unassigned Users were found for this search.</span>
                  </div>
                )}
              </section>
            )}
          </section>

          <footer className="rpt-page-footer">
            <span className="rpt-footer-mark">Z</span>

            <span>ZYRA Organization Intelligence</span>

            <span className="rpt-footer-separator">/</span>

            <span>
              Reporting relationships are based on verified Company workspace
              memberships.
            </span>
          </footer>
        </>
      ) : (
        <div className="rpt-empty-page">
          <AlertCircle size={29} />

          <h2>Reporting structure unavailable</h2>

          <p>
            The Company reporting structure could not be loaded. Refresh the
            page to try again.
          </p>

          <button
            type="button"
            className="rpt-refresh-button"
            onClick={() => void loadStructure()}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
