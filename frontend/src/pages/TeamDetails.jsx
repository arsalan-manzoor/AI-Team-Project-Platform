import {
  Users,
  ArrowLeft,
  UserPlus,
  FolderKanban,
  Pencil,
  X,
  Trash2,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getTeamById,
  getTeamMembers,
  addTeamMember,
  updateTeam,
  removeTeamMember,
} from "../services/teamService";

import { getCurrentUser } from "../services/authService";
import { useWorkspace } from "../context/WorkspaceContext";
import { apiRequest } from "../services/api";

function TeamDetails() {
  const navigate = useNavigate();
  const { teamId } = useParams();

  const {
    workspaceId,
    workspaceType,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [userId, setUserId] = useState("");

  const [availableUsers, setAvailableUsers] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [showEditTeam, setShowEditTeam] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState(false);
  const [updatingTeam, setUpdatingTeam] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [teamEditError, setTeamEditError] = useState("");

  const isCompanyWorkspace =
    String(workspaceType || "").toUpperCase() === "COMPANY";

  const normalizedWorkspaceRole = String(workspaceRole || "")
    .trim()
    .toUpperCase();

  const belongsToActiveWorkspace =
    workspaceId != null &&
    team?.workspace_id != null &&
    String(team.workspace_id) === String(workspaceId);

  // Preserve the current non-Company workspace behavior.
  const canManageTeam =
    !workspaceLoading &&
    (!isCompanyWorkspace ||
      (normalizedWorkspaceRole === "TEAM_LEADER" && belongsToActiveWorkspace));

  // Only a Team Leader assigned to the active workspace
  // can create a project directly under this team.
  const canCreateProjectForTeam =
    !workspaceLoading &&
    normalizedWorkspaceRole === "TEAM_LEADER" &&
    belongsToActiveWorkspace;

  const currentUserId =
    currentUser?.id ?? currentUser?.user?.id ?? currentUser?.data?.id;

  const assignedLeaderId = team?.team_leader_id ?? team?.created_by;

  // Company member removal is limited to the Team Leader assigned
  // to this particular team, with a creator fallback for older teams.
  const canRemoveMembersFromThisTeam =
    !workspaceLoading &&
    isCompanyWorkspace &&
    normalizedWorkspaceRole === "TEAM_LEADER" &&
    belongsToActiveWorkspace &&
    currentUserId != null &&
    assignedLeaderId != null &&
    Number(currentUserId) === Number(assignedLeaderId);

  const companyManagementRestriction =
    "Only the Team Leader assigned to this Company team can remove its members.";

  // Load the authenticated user for team ownership checks.
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUser() {
      try {
        const response = await getCurrentUser();

        const normalizedUser =
          response?.user ?? response?.data?.user ?? response?.data ?? response;

        if (!cancelled) {
          setCurrentUser(normalizedUser);
        }
      } catch (requestError) {
        console.error("Current user loading error:", requestError);
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected team and its members.
  async function loadTeamDetails() {
    try {
      setLoading(true);
      setError("");

      const [teamData, membersData] = await Promise.all([
        getTeamById(teamId),
        getTeamMembers(teamId),
      ]);

      setTeam(teamData);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (requestError) {
      console.error("Team details loading error:", requestError);

      setError(requestError.message || "Failed to load team details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (teamId) {
      void loadTeamDetails();
    }
  }, [teamId]);

  // Load eligible employees from the active Company workspace.
  async function loadAvailableMembers() {
    if (!workspaceId || !isCompanyWorkspace) {
      return;
    }

    try {
      setDirectoryLoading(true);
      setMemberError("");
      setAvailableUsers([]);

      const response = await apiRequest(
        `/workspaces/${encodeURIComponent(workspaceId)}/members`,
      );

      const workspaceMembers = Array.isArray(response?.members)
        ? response.members
        : [];

      // Team member records use "id" for the actual user ID.
      const existingUserIds = new Set(
        members
          .map((member) =>
            Number(member?.id ?? member?.user_id ?? member?.userId),
          )
          .filter((id) => Number.isInteger(id) && id > 0),
      );

      const eligibleUsers = workspaceMembers.filter((member) => {
        const memberUserId = Number(member?.user_id ?? member?.userId);

        const role = String(
          member?.role ?? member?.workspace_role ?? "",
        ).toUpperCase();

        const status = String(member?.account_status ?? "").toUpperCase();

        return (
          Number.isInteger(memberUserId) &&
          memberUserId > 0 &&
          role === "USER" &&
          status === "ACTIVE" &&
          !existingUserIds.has(memberUserId)
        );
      });

      setAvailableUsers(eligibleUsers);

      if (eligibleUsers.length === 0) {
        setMemberError(
          "No eligible active employees are available to add. Employees already in this team are excluded.",
        );
      }
    } catch (requestError) {
      console.error("Company directory loading error:", requestError);

      setAvailableUsers([]);

      setMemberError(
        requestError.message ||
          "Unable to load the Company Employee Directory.",
      );
    } finally {
      setDirectoryLoading(false);
    }
  }

  // Open the existing team-edit form.
  function handleOpenEditTeam() {
    setError("");
    setTeamEditError("");
    setTeamName(team?.name || "");
    setTeamDescription(team?.description || "");
    setShowEditTeam(true);
  }

  function handleCancelEditTeam() {
    setShowEditTeam(false);
    setTeamName("");
    setTeamDescription("");
    setTeamEditError("");
  }

  async function handleUpdateTeam(event) {
    event.preventDefault();

    setTeamEditError("");

    const name = teamName.trim();
    const description = teamDescription.trim();

    if (!name) {
      setTeamEditError("Please enter a team name.");
      return;
    }

    try {
      setUpdatingTeam(true);

      const updatedTeam = await updateTeam(teamId, {
        name,
        description,
      });

      setTeam(updatedTeam);
      setShowEditTeam(false);
      setTeamName("");
      setTeamDescription("");
    } catch (requestError) {
      console.error("Team update error:", requestError);

      setTeamEditError(requestError.message || "Failed to update team.");
    } finally {
      setUpdatingTeam(false);
    }
  }

  // Add an employee selected from the Company Directory.
  // Non-Company workspaces retain their existing user-ID input.
  async function handleAddMember(event) {
    event.preventDefault();

    setMemberError("");

    if (!userId) {
      setMemberError(
        isCompanyWorkspace
          ? "Please select an employee from the directory."
          : "Please enter a user ID.",
      );
      return;
    }

    const selectedUserId = Number(userId);

    if (!Number.isInteger(selectedUserId) || selectedUserId <= 0) {
      setMemberError(
        isCompanyWorkspace
          ? "Please select a valid employee."
          : "User ID must be a positive number.",
      );
      return;
    }

    // Prevent submitting an arbitrary ID through the Company form.
    if (
      isCompanyWorkspace &&
      !availableUsers.some(
        (employee) =>
          Number(employee?.user_id ?? employee?.userId) === selectedUserId,
      )
    ) {
      setMemberError(
        "Please select an eligible employee from the Company Directory.",
      );
      return;
    }

    try {
      setAddingMember(true);

      await addTeamMember(teamId, selectedUserId);

      setUserId("");
      setShowAddMember(false);
      setAvailableUsers([]);

      await loadTeamDetails();
    } catch (requestError) {
      console.error("Add member error:", requestError);

      setMemberError(requestError.message || "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  }

  // Remove a USER from this team only.
  async function handleRemoveMember(member) {
    if (!canRemoveMembersFromThisTeam) {
      setError(companyManagementRestriction);
      return;
    }

    const memberRole = String(member?.workspace_role || "").toUpperCase();

    if (memberRole !== "USER") {
      setError(
        "Only employees with the USER role can be removed from this team.",
      );
      return;
    }

    const targetUserId = member?.id ?? member?.user_id ?? member?.userId;

    if (!Number.isInteger(Number(targetUserId)) || Number(targetUserId) <= 0) {
      setError("This team member does not have a valid user ID.");
      return;
    }

    const targetName = member?.name || member?.email || `User ${targetUserId}`;

    const confirmed = window.confirm(
      `Remove ${targetName} from "${team?.name}"?\n\nThey will remain a member of the Company workspace and any other teams they belong to.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setRemovingMemberId(String(targetUserId));
      setError("");

      await removeTeamMember(teamId, Number(targetUserId));

      await loadTeamDetails();
    } catch (requestError) {
      console.error("Remove team member error:", requestError);

      setError(requestError.message || "Failed to remove this team member.");
    } finally {
      setRemovingMemberId(null);
    }
  }

  // Toggle Add Member and load the directory when opening it.
  function handleToggleAddMember() {
    const shouldOpen = !showAddMember;

    setShowAddMember(shouldOpen);
    setMemberError("");
    setError("");

    if (shouldOpen && isCompanyWorkspace) {
      setUserId("");
      void loadAvailableMembers();
    } else if (!shouldOpen) {
      setUserId("");
      setAvailableUsers([]);
    }
  }

  // Open Create Project with this specific team's ID.
  function handleCreateProject() {
    if (!canCreateProjectForTeam) {
      setError(
        "You must be a Team Leader in the active workspace to create a project under this team.",
      );
      return;
    }

    const selectedTeamId = team?.id ?? team?.team_id ?? teamId;

    if (!selectedTeamId) {
      setError("Unable to identify this team. Please reload the page.");
      return;
    }

    navigate(`/projects/create?teamId=${encodeURIComponent(selectedTeamId)}`);
  }

  return (
    <div className="zyra-teams">
      <button
        type="button"
        className="back-page-btn"
        onClick={() => navigate("/teams")}
        disabled={addingMember || updatingTeam || removingMemberId !== null}
      >
        <ArrowLeft size={15} />
        Back to Teams
      </button>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="teams-empty">
          <div className="teams-empty-icon">
            <Users size={28} />
          </div>

          <h3>Loading team...</h3>

          <p>Getting team information from the ZYRA workspace.</p>
        </div>
      ) : !team ? (
        <div className="teams-empty">
          <div className="teams-empty-icon">
            <Users size={28} />
          </div>

          <h3>Team not found</h3>

          <p>The requested team could not be found.</p>
        </div>
      ) : (
        <>
          <div className="teams-header">
            <div>
              <p className="teams-eyebrow">TEAM WORKSPACE</p>

              <h2>{team.name}</h2>

              <p className="teams-subtitle">
                {team.description || "Manage your team and collaborators."}
              </p>

              {!workspaceLoading && isCompanyWorkspace && !canManageTeam && (
                <p className="teams-subtitle">
                  Team editing and member management are available only to a
                  Team Leader in this Company workspace.
                </p>
              )}
            </div>

            {canManageTeam && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {canCreateProjectForTeam && (
                  <button
                    type="button"
                    className="teams-create-btn"
                    onClick={handleCreateProject}
                    disabled={
                      addingMember || updatingTeam || removingMemberId !== null
                    }
                    title="Create a project under this team"
                  >
                    <FolderKanban size={17} />
                    Create Project
                  </button>
                )}

                <button
                  type="button"
                  className="teams-create-btn"
                  onClick={handleOpenEditTeam}
                  disabled={
                    addingMember || updatingTeam || removingMemberId !== null
                  }
                >
                  <Pencil size={17} />
                  Edit Team
                </button>

                <button
                  type="button"
                  className="teams-create-btn"
                  onClick={handleToggleAddMember}
                  disabled={
                    addingMember || updatingTeam || removingMemberId !== null
                  }
                >
                  <UserPlus size={17} />
                  {showAddMember ? "Cancel" : "Add Member"}
                </button>
              </div>
            )}
          </div>

          {showEditTeam && canManageTeam && (
            <form
              className="zyra-create-form"
              onSubmit={handleUpdateTeam}
              style={{ marginBottom: "24px" }}
            >
              <div className="form-section">
                <div className="form-section-header">
                  <h3>Edit Team</h3>

                  <p>Update the name and description of this team.</p>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-team-name">Team Name</label>

                  <input
                    id="edit-team-name"
                    type="text"
                    placeholder="Enter team name"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    disabled={updatingTeam}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-team-description">Description</label>

                  <textarea
                    id="edit-team-description"
                    placeholder="Enter team description"
                    value={teamDescription}
                    onChange={(event) => setTeamDescription(event.target.value)}
                    disabled={updatingTeam}
                    rows="4"
                  />
                </div>

                {teamEditError && (
                  <p className="login-error">{teamEditError}</p>
                )}

                <div className="create-form-actions">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={handleCancelEditTeam}
                    disabled={updatingTeam}
                  >
                    <X size={16} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={updatingTeam}
                  >
                    <Pencil size={16} />
                    {updatingTeam ? "Updating..." : "Update Team"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {showAddMember && canManageTeam && (
            <form
              className="zyra-create-form"
              onSubmit={handleAddMember}
              style={{ marginBottom: "24px" }}
            >
              <div className="form-section">
                <div className="form-section-header">
                  <h3>Add Team Member</h3>

                  <p>
                    {isCompanyWorkspace
                      ? "Choose an eligible employee from your Company Directory."
                      : "Enter the user ID of an existing ZYRA user."}
                  </p>
                </div>

                {isCompanyWorkspace ? (
                  <div className="form-group">
                    <label htmlFor="team-member-select">Select Employee</label>

                    <select
                      id="team-member-select"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                      disabled={
                        directoryLoading ||
                        addingMember ||
                        availableUsers.length === 0
                      }
                      required
                      style={{
                        width: "100%",
                        minHeight: "46px",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid rgba(125, 165, 205, 0.3)",
                        background: "#111827",
                        color: "#f1f5f9",
                      }}
                    >
                      <option value="">
                        {directoryLoading
                          ? "Loading employee directory..."
                          : availableUsers.length > 0
                            ? "Choose an employee"
                            : "No eligible employees available"}
                      </option>

                      {availableUsers.map((employee) => {
                        const employeeId = employee.user_id ?? employee.userId;

                        const employeeName =
                          employee.name ||
                          employee.email ||
                          `Employee ${employeeId}`;

                        const optionLabel =
                          employee.name && employee.email
                            ? `${employee.name} — ${employee.email}`
                            : employeeName;

                        return (
                          <option key={employeeId} value={String(employeeId)}>
                            {optionLabel}
                          </option>
                        );
                      })}
                    </select>

                    <small>
                      Only active employees with the USER role who aren't
                      already in this team are shown.
                    </small>
                  </div>
                ) : (
                  <div className="form-group">
                    <label htmlFor="team-member-user-id">User ID</label>

                    <input
                      id="team-member-user-id"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Enter user ID"
                      value={userId}
                      onChange={(event) => setUserId(event.target.value)}
                      disabled={addingMember}
                      required
                    />
                  </div>
                )}

                {memberError && (
                  <p className="login-error" role="alert">
                    {memberError}
                  </p>
                )}

                <div className="create-form-actions">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={() => {
                      setShowAddMember(false);
                      setUserId("");
                      setAvailableUsers([]);
                      setMemberError("");
                    }}
                    disabled={addingMember}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="submit-project-btn"
                    disabled={
                      addingMember ||
                      directoryLoading ||
                      (isCompanyWorkspace && availableUsers.length === 0)
                    }
                  >
                    <UserPlus size={16} />
                    {addingMember ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="teams-summary">
            <div className="team-summary-card">
              <div className="team-summary-icon">
                <Users size={19} />
              </div>

              <div>
                <span>Team Members</span>
                <strong>{members.length}</strong>
              </div>
            </div>

            <div className="team-summary-card">
              <div className="team-summary-icon">
                <FolderKanban size={19} />
              </div>

              <div>
                <span>Team ID</span>
                <strong>{teamId}</strong>
              </div>
            </div>
          </div>

          <section className="teams-panel">
            <div className="teams-panel-header">
              <div>
                <h3>Team Members</h3>

                <p>People currently working in this team.</p>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="teams-empty">
                <div className="teams-empty-icon">
                  <Users size={28} />
                </div>

                <h3>No members yet</h3>

                <p>
                  {canManageTeam
                    ? "Add members to start collaborating on this team."
                    : "No members have been added to this team yet."}
                </p>
              </div>
            ) : (
              <div className="team-list">
                {members.map((member) => {
                  const memberId =
                    member?.id ?? member?.user_id ?? member?.userId;

                  const memberRole = String(
                    member?.workspace_role || "",
                  ).toUpperCase();

                  const memberName =
                    member?.name || member?.email || `User ${memberId}`;

                  const isRemoving = removingMemberId === String(memberId);

                  const canShowRemoveButton =
                    canRemoveMembersFromThisTeam && memberRole === "USER";

                  return (
                    <div className="team-card" key={memberId}>
                      <div className="team-card-main">
                        <div className="team-card-icon">
                          <Users size={22} />
                        </div>

                        <div>
                          <h3>{memberName}</h3>
                          <p>{member?.email || "Team member"}</p>
                        </div>
                      </div>

                      {canShowRemoveButton && (
                        <div
                          className="team-card-actions"
                          style={{
                            justifyContent: "flex-end",
                            marginTop: "12px",
                          }}
                        >
                          <button
                            type="button"
                            className="team-delete-btn"
                            onClick={() => void handleRemoveMember(member)}
                            disabled={
                              removingMemberId !== null ||
                              addingMember ||
                              updatingTeam
                            }
                            title={`Remove ${memberName} from this team`}
                          >
                            <Trash2 size={14} />
                            {isRemoving ? "Removing..." : "Remove from team"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default TeamDetails;
