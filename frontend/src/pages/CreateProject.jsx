import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Users,
  CheckSquare,
  Flag,
  FileText,
  Plus,
  CalendarDays,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../styles/create-project.css";

import { createProject } from "../services/ProjectService";
import { getTeams } from "../services/teamService";
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext";

/* ============================================================
   RESPONSE HELPERS
============================================================ */

function getResponseArray(response, key) {
  if (Array.isArray(response)) {
    return response;
  }

  if (key && Array.isArray(response?.[key])) {
    return response[key];
  }

  if (key && Array.isArray(response?.data?.[key])) {
    return response.data[key];
  }

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

  if (Array.isArray(response?.data?.teamLeaders)) {
    return response.data.teamLeaders;
  }

  if (Array.isArray(response?.data?.team_leaders)) {
    return response.data.team_leaders;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function normalizeId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);

  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }

  return normalized;
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getTeamId(team) {
  return team?.id ?? team?.team_id ?? team?.teamId;
}

function getTeamWorkspaceId(team) {
  return (
    team?.workspace_id ??
    team?.workspaceId ??
    team?.workspace?.id ??
    team?.workspace?.workspace_id ??
    team?.workspace?.workspaceId
  );
}

function getMemberId(member) {
  return normalizeId(member?.user_id ?? member?.userId ?? member?.id);
}

function sameId(first, second) {
  const firstId = normalizeId(first);
  const secondId = normalizeId(second);

  return firstId !== null && secondId !== null && firstId === secondId;
}

/* ============================================================
   TEAM LEADER ASSIGNMENT NORMALIZER
============================================================ */

function normalizeTeamLeaderAssignment(assignment) {
  const teamLeader =
    assignment?.team_leader ||
    assignment?.teamLeader ||
    assignment?.leader ||
    assignment?.user ||
    assignment;

  const id = normalizeId(
    teamLeader?.team_leader_user_id ??
      teamLeader?.teamLeaderUserId ??
      teamLeader?.team_leader_id ??
      teamLeader?.teamLeaderId ??
      teamLeader?.user_id ??
      teamLeader?.userId ??
      teamLeader?.id,
  );

  const name =
    teamLeader?.team_leader_name ||
    teamLeader?.teamLeaderName ||
    teamLeader?.name ||
    teamLeader?.full_name ||
    "Team Leader";

  const email =
    teamLeader?.team_leader_email ||
    teamLeader?.teamLeaderEmail ||
    teamLeader?.email ||
    "";

  // Backend returns team_leader_account_status.
  const accountStatus = normalizeRole(
    teamLeader?.team_leader_account_status ??
      teamLeader?.account_status ??
      teamLeader?.accountStatus ??
      assignment?.team_leader_account_status ??
      assignment?.account_status ??
      assignment?.accountStatus,
  );

  const role = normalizeRole(
    teamLeader?.workspace_role ??
      teamLeader?.workspaceRole ??
      teamLeader?.role ??
      assignment?.workspace_role ??
      assignment?.role,
  );

  return {
    id,
    name,
    email,
    accountStatus,
    role,
  };
}

/* ============================================================
   CREATE PROJECT
============================================================ */

function CreateProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  /*
   * When opened from Team Details:
   *
   * /projects/create?teamId=123
   *
   * This context is retained for Team Leaders.
   */

  const requestedTeamParam = searchParams.get("teamId");

  const hasTeamContext = requestedTeamParam !== null;

  const requestedTeamId = normalizeId(requestedTeamParam);

  const {
    activeWorkspace,
    workspaceId,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  /* ============================================================
     ACTIVE WORKSPACE INFORMATION
  ============================================================ */

  const normalizedWorkspaceRole = normalizeRole(workspaceRole);

  const normalizedWorkspaceType = normalizeRole(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType,
  );

  const normalizedWorkspaceId = normalizeId(workspaceId);

  const isCompanyWorkspace = normalizedWorkspaceType === "COMPANY";

  /*
   * COMPANY ADMIN:
   * Creates independent Company projects and assigns HR.
   *
   * COMPANY HR:
   * Creates independent Company projects and assigns one
   * of their assigned Team Leaders.
   *
   * TEAM_LEADER:
   * Keeps the existing team-based project workflow.
   */

  const isCompanyAdmin =
    isCompanyWorkspace && normalizedWorkspaceRole === "ADMIN";

  const isCompanyHR = isCompanyWorkspace && normalizedWorkspaceRole === "HR";

  const isTeamLeader = normalizedWorkspaceRole === "TEAM_LEADER";

  const isIndependentCompanyCreator = isCompanyAdmin || isCompanyHR;

  const canCreateProjects = isIndependentCompanyCreator || isTeamLeader;

  const workspaceName =
    activeWorkspace?.name ||
    activeWorkspace?.workspace_name ||
    "the active workspace";

  /* ============================================================
     PROJECT STATE
  ============================================================ */

  const [project, setProject] = useState({
    name: "",
    description: "",
    teamId: "",
    assignedHrUserId: "",
    assignedTeamLeaderUserId: "",
  });

  /* ============================================================
     TEAM STATE
  ============================================================ */

  const [teams, setTeams] = useState([]);

  const [loadingTeams, setLoadingTeams] = useState(false);

  /* ============================================================
     HR STATE
  ============================================================ */

  const [hrEmployees, setHrEmployees] = useState([]);

  const [loadingHrEmployees, setLoadingHrEmployees] = useState(false);

  /* ============================================================
     TEAM LEADER STATE
  ============================================================ */

  const [teamLeaders, setTeamLeaders] = useState([]);

  const [loadingTeamLeaders, setLoadingTeamLeaders] = useState(false);

  /* ============================================================
     GENERAL STATE
  ============================================================ */

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  /* ============================================================
     LOAD CREATION OPTIONS

     COMPANY ADMIN:
     Load active HR employees.

     COMPANY HR:
     Load Team Leaders assigned to the logged-in HR.

     TEAM_LEADER:
     Load teams belonging to the active workspace.
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    async function loadCreationOptions() {
      setError("");

      setTeams([]);
      setHrEmployees([]);
      setTeamLeaders([]);

      setLoadingTeams(false);
      setLoadingHrEmployees(false);
      setLoadingTeamLeaders(false);

      // Clear selections when workspace or role changes.
      setProject((current) => ({
        ...current,
        teamId: "",
        assignedHrUserId: "",
        assignedTeamLeaderUserId: "",
      }));

      if (workspaceLoading) {
        return;
      }

      if (normalizedWorkspaceId === null) {
        setError("No valid active workspace was found.");
        return;
      }

      /* ======================================================
         COMPANY ADMIN: LOAD HR EMPLOYEES
      ====================================================== */

      if (isCompanyAdmin) {
        setLoadingHrEmployees(true);

        try {
          const response = await apiRequest(
            `/workspaces/company/${normalizedWorkspaceId}/organization-members`,
          );

          if (cancelled) {
            return;
          }

          const loadedMembers = getResponseArray(response, "members");

          const eligibleHR = loadedMembers
            .filter((member) => {
              const memberId = getMemberId(member);

              const role = normalizeRole(
                member?.workspace_role ?? member?.role,
              );

              const accountStatus = normalizeRole(member?.account_status);

              const membershipId = normalizeId(member?.workspace_membership_id);

              return (
                memberId !== null &&
                membershipId !== null &&
                role === "HR" &&
                accountStatus === "ACTIVE"
              );
            })
            .map((member) => ({
              id: getMemberId(member),
              name: member?.name || member?.full_name || "HR Employee",
              email: member?.email || "",
              role: "HR",
            }));

          if (cancelled) {
            return;
          }

          setHrEmployees(eligibleHR);

          if (eligibleHR.length === 0) {
            setError(
              "No active HR employees are available in this Company Workspace. Add an active HR employee before creating a Company project.",
            );
          }
        } catch (loadError) {
          if (!cancelled) {
            console.error("Failed to load Company HR employees:", loadError);

            setHrEmployees([]);

            setError(
              loadError.message ||
                "Unable to load HR employees for this Company Workspace.",
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingHrEmployees(false);
          }
        }

        return;
      }

      /* ======================================================
         COMPANY HR: LOAD ASSIGNED TEAM LEADERS
      ====================================================== */

      if (isCompanyHR) {
        setLoadingTeamLeaders(true);

        try {
          /*
           * Correct existing HR assignment endpoint.
           *
           * This endpoint returns the Team Leaders assigned
           * to the currently authenticated HR employee.
           */

          const response = await apiRequest(
            `/workspaces/company/${normalizedWorkspaceId}/hr-team-leader-assignments`,
          );

          if (cancelled) {
            return;
          }

          const loadedAssignments = getResponseArray(response, "assignments");

          /*
           * Normalize the assignment response.
           *
           * Backend fields include:
           * team_leader_user_id
           * team_leader_name
           * team_leader_email
           * team_leader_account_status
           */

          const normalizedAssignments = loadedAssignments
            .map(normalizeTeamLeaderAssignment)
            .filter((leader) => {
              if (leader.id === null) {
                return false;
              }

              // Only active Team Leaders are eligible.
              if (leader.accountStatus !== "ACTIVE") {
                return false;
              }

              // If a role is returned, it must be TEAM_LEADER.
              if (leader.role && leader.role !== "TEAM_LEADER") {
                return false;
              }

              return true;
            });

          // Remove duplicate Team Leaders.
          const uniqueTeamLeaders = [
            ...new Map(
              normalizedAssignments.map((leader) => [
                leader.id,
                {
                  id: leader.id,
                  name: leader.name,
                  email: leader.email,
                  role: "TEAM_LEADER",
                },
              ]),
            ).values(),
          ];

          if (cancelled) {
            return;
          }

          setTeamLeaders(uniqueTeamLeaders);

          if (uniqueTeamLeaders.length === 0) {
            setError(
              "You do not have any active Team Leaders assigned to you. Assign a Team Leader before creating a project.",
            );
          }
        } catch (loadError) {
          if (!cancelled) {
            console.error(
              "Failed to load HR-assigned Team Leaders:",
              loadError,
            );

            setTeamLeaders([]);

            setError(
              loadError.message || "Unable to load your assigned Team Leaders.",
            );
          }
        } finally {
          if (!cancelled) {
            setLoadingTeamLeaders(false);
          }
        }

        return;
      }

      /* ======================================================
         TEAM LEADER: LOAD WORKSPACE TEAMS
      ====================================================== */

      if (!isTeamLeader) {
        setError(
          "Only a Company Admin, HR employee, or Team Leader can create projects in the active workspace.",
        );

        return;
      }

      setLoadingTeams(true);

      if (hasTeamContext && requestedTeamId === null) {
        setError(
          "The team link is invalid. Please return to the Team page and open Create Project again.",
        );

        setLoadingTeams(false);
        return;
      }

      try {
        const teamsData = await getTeams();

        if (cancelled) {
          return;
        }

        const loadedTeams = getResponseArray(teamsData, "teams");

        const normalizedTeams = loadedTeams
          .map((team) => ({
            ...team,
            id: getTeamId(team),
            workspace_id: getTeamWorkspaceId(team),
          }))
          .filter((team) => normalizeId(team.id) !== null);

        const hasWorkspaceMetadata = normalizedTeams.some(
          (team) => normalizeId(team.workspace_id) !== null,
        );

        if (normalizedTeams.length > 0 && !hasWorkspaceMetadata) {
          throw new Error(
            "The teams API did not return workspace IDs. Teams cannot be safely selected until workspace information is available.",
          );
        }

        const workspaceTeams = normalizedTeams.filter((team) =>
          sameId(team.workspace_id, normalizedWorkspaceId),
        );

        if (cancelled) {
          return;
        }

        setTeams(workspaceTeams);

        if (workspaceTeams.length === 0) {
          setError(
            `No teams linked to ${workspaceName} were returned by the teams API. A Team Leader must have an existing team before creating a team-based project.`,
          );

          return;
        }

        if (hasTeamContext) {
          const requestedTeam = workspaceTeams.find((team) =>
            sameId(team.id, requestedTeamId),
          );

          if (!requestedTeam) {
            setError(
              "The selected team does not belong to the active workspace or is no longer available. Please return to Teams and try again.",
            );

            return;
          }

          setProject((current) => ({
            ...current,
            teamId: String(requestedTeam.id),
          }));

          return;
        }

        if (workspaceTeams.length === 1) {
          setProject((current) => ({
            ...current,
            teamId: String(workspaceTeams[0].id),
          }));

          return;
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load workspace teams:", loadError);

          setTeams([]);

          setError(
            loadError.message ||
              "Failed to load teams for the active workspace.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingTeams(false);
        }
      }
    }

    loadCreationOptions();

    return () => {
      cancelled = true;
    };
  }, [
    normalizedWorkspaceId,
    normalizedWorkspaceRole,
    normalizedWorkspaceType,
    workspaceLoading,
    workspaceName,
    isCompanyAdmin,
    isCompanyHR,
    isTeamLeader,
    hasTeamContext,
    requestedTeamId,
  ]);

  /* ============================================================
     SELECTED ITEMS
  ============================================================ */

  const selectedTeam = teams.find((team) => sameId(team.id, project.teamId));

  const selectedHR = hrEmployees.find((employee) =>
    sameId(employee.id, project.assignedHrUserId),
  );

  const selectedTeamLeader = teamLeaders.find((leader) =>
    sameId(leader.id, project.assignedTeamLeaderUserId),
  );

  /* ============================================================
     CREATE PROJECT
  ============================================================ */

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (workspaceLoading) {
      setError("The active workspace is still loading.");
      return;
    }

    if (normalizedWorkspaceId === null) {
      setError("No valid active workspace was found.");
      return;
    }

    if (!canCreateProjects) {
      setError(
        "You do not have permission to create projects in the active workspace.",
      );

      return;
    }

    const normalizedName = project.name.trim();

    const normalizedDescription = project.description.trim();

    if (!normalizedName) {
      setError("Please enter a project name.");
      return;
    }

    /* ========================================================
       COMPANY ADMIN: DIRECT PROJECT CREATION
    ======================================================== */

    if (isCompanyAdmin) {
      const assignedHrId = normalizeId(project.assignedHrUserId);

      if (assignedHrId === null) {
        setError("Please assign this Company project to an HR employee.");
        return;
      }

      const assignedHR = hrEmployees.find((employee) =>
        sameId(employee.id, assignedHrId),
      );

      if (!assignedHR) {
        setError(
          "The selected HR employee is not available in this Company Workspace. Please select another employee.",
        );

        return;
      }

      try {
        setLoading(true);

        await createProject({
          name: normalizedName,
          description: normalizedDescription,
          workspaceId: normalizedWorkspaceId,
          assignedHrUserId: assignedHrId,
        });

        window.alert(
          "Company project created and assigned to HR successfully!",
        );

        navigate("/projects");
      } catch (createError) {
        console.error("Company project creation error:", createError);

        setError(
          createError.message || "Failed to create the Company project.",
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    /* ========================================================
       COMPANY HR: ASSIGN PROJECT TO AN ASSIGNED TEAM LEADER
    ======================================================== */

    if (isCompanyHR) {
      const assignedTeamLeaderId = normalizeId(
        project.assignedTeamLeaderUserId,
      );

      if (assignedTeamLeaderId === null) {
        setError("Please select one of your assigned Team Leaders.");
        return;
      }

      const assignedLeader = teamLeaders.find((leader) =>
        sameId(leader.id, assignedTeamLeaderId),
      );

      if (!assignedLeader) {
        setError(
          "The selected Team Leader is not in your assigned Team Leader list. Please select a valid Team Leader.",
        );

        return;
      }

      try {
        setLoading(true);

        /*
         * No teamId is sent.
         *
         * The backend creates an independent Company project,
         * records the current HR as assigned_hr_user_id,
         * and assigns the selected Team Leader.
         */

        await createProject({
          name: normalizedName,
          description: normalizedDescription,
          workspaceId: normalizedWorkspaceId,
          assignedTeamLeaderUserId: assignedTeamLeaderId,
        });

        window.alert(
          "Project created and assigned to the Team Leader successfully!",
        );

        navigate("/projects");
      } catch (createError) {
        console.error("HR project creation error:", createError);

        setError(
          createError.message ||
            "Failed to create the project. Please try again.",
        );
      } finally {
        setLoading(false);
      }

      return;
    }

    /* ========================================================
       TEAM LEADER: EXISTING TEAM-BASED CREATION
    ======================================================== */

    if (!isTeamLeader) {
      setError("You do not have permission to create a team-based project.");
      return;
    }

    if (loadingTeams) {
      setError("Teams are still loading. Please try again.");
      return;
    }

    const selectedTeamId = normalizeId(project.teamId);

    if (selectedTeamId === null) {
      setError("Please select a team from the active workspace.");
      return;
    }

    if (
      hasTeamContext &&
      (requestedTeamId === null || !sameId(selectedTeamId, requestedTeamId))
    ) {
      setError(
        "The project must be created under the team you opened. Please return to that team's page and try again.",
      );

      return;
    }

    const team = teams.find((item) => sameId(item.id, selectedTeamId));

    if (!team) {
      setError(
        "The selected team is not available in the active workspace. Please reload the page and select a valid team.",
      );

      return;
    }

    if (!sameId(team.workspace_id, normalizedWorkspaceId)) {
      setError(
        "This team does not belong to the active workspace. The project was not submitted.",
      );

      return;
    }

    try {
      setLoading(true);

      await createProject({
        name: normalizedName,
        description: normalizedDescription,
        teamId: selectedTeamId,
        workspaceId: normalizedWorkspaceId,
      });

      window.alert("Project created successfully!");

      navigate("/projects");
    } catch (createError) {
      console.error("Project creation error:", createError);

      setError(createError.message || "Failed to create the project.");
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     PREVIEW
  ============================================================ */

  const projectName = project.name.trim() || "Your Project Name";

  const projectDescription =
    project.description.trim() || "Your project description will appear here.";

  /* ============================================================
     BUTTON STATE
  ============================================================ */

  const creationOptionsLoading = isCompanyAdmin
    ? loadingHrEmployees
    : isCompanyHR
      ? loadingTeamLeaders
      : loadingTeams;

  const missingCreationAssignment = isCompanyAdmin
    ? normalizeId(project.assignedHrUserId) === null || hrEmployees.length === 0
    : isCompanyHR
      ? normalizeId(project.assignedTeamLeaderUserId) === null ||
        teamLeaders.length === 0
      : normalizeId(project.teamId) === null || teams.length === 0;

  const submitDisabled =
    loading ||
    workspaceLoading ||
    !canCreateProjects ||
    creationOptionsLoading ||
    missingCreationAssignment;

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div className="zyra-create-page">
      {/* BACKGROUND */}

      <div className="create-project-background" aria-hidden="true">
        <div className="create-bg-orb create-bg-orb-one" />
        <div className="create-bg-orb create-bg-orb-two" />
        <div className="create-bg-orb create-bg-orb-three" />
      </div>

      {/* TOP NAVIGATION */}

      <div className="create-project-topbar">
        <button
          type="button"
          className="create-back-button"
          onClick={() => navigate("/projects")}
          disabled={loading}
        >
          <ArrowLeft size={15} />
          <span>Back to Projects</span>
        </button>

        <div className="create-breadcrumb">
          <span>Projects</span>
          <span className="breadcrumb-separator">›</span>
          <span>New</span>
        </div>
      </div>

      {/* MAIN LAYOUT */}

      <div className="create-project-layout">
        {/* LEFT SIDE */}

        <div className="create-project-content">
          <div className="create-project-heading">
            <span className="create-project-label">PROJECT WORKSPACE</span>

            <h1>What are we building?</h1>

            <p>
              {isCompanyAdmin
                ? "Create a Company project directly and assign an HR employee to manage its next steps."
                : isCompanyHR
                  ? "Create a project and assign it to one of your assigned Team Leaders."
                  : "Set up your project and define what your team wants to achieve."}
            </p>

            <p>
              Creating in: <strong>{workspaceName}</strong>
            </p>
          </div>

          <form className="create-project-form" onSubmit={handleSubmit}>
            {/* PROJECT NAME */}

            <div className="create-field">
              <label htmlFor="project-name">Project name</label>

              <input
                id="project-name"
                type="text"
                placeholder="e.g., Acme Platform Launch"
                value={project.name}
                onChange={(event) => {
                  setProject((current) => ({
                    ...current,
                    name: event.target.value,
                  }));

                  setError("");
                }}
                required
                disabled={loading}
              />
            </div>

            {/* DESCRIPTION */}

            <div className="create-field">
              <label htmlFor="project-description">Project description</label>

              <div className="description-wrapper">
                <div className="description-toolbar">
                  <button type="button" tabIndex="-1">
                    B
                  </button>

                  <button type="button" tabIndex="-1">
                    <span className="italic-icon">I</span>
                  </button>

                  <button type="button" tabIndex="-1">
                    <span className="underline-icon">U</span>
                  </button>

                  <span className="toolbar-divider" />

                  <button type="button" tabIndex="-1">
                    •
                  </button>

                  <button type="button" tabIndex="-1">
                    ≡
                  </button>

                  <button type="button" tabIndex="-1">
                    ↗
                  </button>
                </div>

                <textarea
                  id="project-description"
                  placeholder="e.g., Describe the goals, scope, and objectives of the project..."
                  rows="6"
                  value={project.description}
                  onChange={(event) => {
                    setProject((current) => ({
                      ...current,
                      description: event.target.value,
                    }));

                    setError("");
                  }}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* =================================================
                COMPANY ADMIN: HR ASSIGNMENT
            ================================================= */}

            {isCompanyAdmin && (
              <div className="create-field">
                <label htmlFor="project-hr">Assign HR employee</label>

                <div className="team-select-wrapper">
                  <div className="team-select-icon">
                    <Users size={15} />
                  </div>

                  <select
                    id="project-hr"
                    value={project.assignedHrUserId}
                    onChange={(event) => {
                      setProject((current) => ({
                        ...current,
                        assignedHrUserId: event.target.value,
                      }));

                      setError("");
                    }}
                    required
                    disabled={
                      loading ||
                      loadingHrEmployees ||
                      workspaceLoading ||
                      hrEmployees.length === 0
                    }
                  >
                    {loadingHrEmployees ? (
                      <option value="">Loading HR employees...</option>
                    ) : hrEmployees.length === 0 ? (
                      <option value="">No active HR employees available</option>
                    ) : (
                      <>
                        <option value="">Select an HR employee...</option>

                        {hrEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                            {employee.email ? ` — ${employee.email}` : ""}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <p className="create-project-assignment-note">
                  The project will initially belong to the Company Workspace.
                  The responsible Team Leader can attach it to a team later.
                </p>
              </div>
            )}

            {/* =================================================
                COMPANY HR: ASSIGNED TEAM LEADER SELECTION
            ================================================= */}

            {isCompanyHR && (
              <div className="create-field">
                <label htmlFor="project-team-leader">Assign Team Leader</label>

                <div className="team-select-wrapper">
                  <div className="team-select-icon">
                    <Users size={15} />
                  </div>

                  <select
                    id="project-team-leader"
                    value={project.assignedTeamLeaderUserId}
                    onChange={(event) => {
                      setProject((current) => ({
                        ...current,
                        assignedTeamLeaderUserId: event.target.value,
                      }));

                      setError("");
                    }}
                    required
                    disabled={
                      loading ||
                      loadingTeamLeaders ||
                      workspaceLoading ||
                      teamLeaders.length === 0
                    }
                  >
                    {loadingTeamLeaders ? (
                      <option value="">
                        Loading your assigned Team Leaders...
                      </option>
                    ) : teamLeaders.length === 0 ? (
                      <option value="">
                        No assigned Team Leaders available
                      </option>
                    ) : (
                      <>
                        <option value="">
                          Select an assigned Team Leader...
                        </option>

                        {teamLeaders.map((leader) => (
                          <option key={leader.id} value={leader.id}>
                            {leader.name}
                            {leader.email ? ` — ${leader.email}` : ""}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <p className="create-project-assignment-note">
                  Only active Team Leaders assigned to you are available. The
                  selected Team Leader will receive the project and can create a
                  team and attach it to the project.
                </p>
              </div>
            )}

            {/* =================================================
                TEAM LEADER: TEAM SELECTION
            ================================================= */}

            {isTeamLeader &&
              (!hasTeamContext && teams.length > 1 ? (
                <div className="create-field">
                  <label htmlFor="project-team">Team</label>

                  <div className="team-select-wrapper">
                    <div className="team-select-icon">
                      <Users size={15} />
                    </div>

                    <select
                      id="project-team"
                      value={project.teamId}
                      onChange={(event) => {
                        setProject((current) => ({
                          ...current,
                          teamId: event.target.value,
                        }));

                        setError("");
                      }}
                      required
                      disabled={
                        loading ||
                        loadingTeams ||
                        workspaceLoading ||
                        !isTeamLeader
                      }
                    >
                      <option value="">Select a team...</option>

                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name || `Team #${team.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="create-field">
                  <label htmlFor="project-team-display">Team</label>

                  <input
                    id="project-team-display"
                    type="text"
                    value={
                      workspaceLoading || loadingTeams
                        ? "Loading team..."
                        : selectedTeam?.name ||
                          (hasTeamContext
                            ? "Selected team unavailable"
                            : teams.length === 0
                              ? "No team available"
                              : "No team selected")
                    }
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              ))}

            {/* ERROR */}

            {error && (
              <p className="create-project-error" role="alert">
                {error}
              </p>
            )}

            {/* ACTIONS */}

            <div className="create-project-actions">
              <button
                type="submit"
                className="create-project-submit"
                disabled={submitDisabled}
              >
                {loading ? (
                  <>
                    <span className="button-spinner" />
                    Creating...
                  </>
                ) : isCompanyAdmin ? (
                  "Create Company project"
                ) : isCompanyHR ? (
                  "Create and assign project"
                ) : (
                  "Create project"
                )}
              </button>

              <button
                type="button"
                className="create-project-cancel"
                onClick={() => navigate("/projects")}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: PROJECT PREVIEW */}

        <aside className="project-preview">
          <div className="preview-header">
            <span>Project Preview</span>
            <span className="preview-status">DRAFT</span>
          </div>

          <div className="preview-project-name">
            {projectName}
            <span className="draft-label">(Draft)</span>
          </div>

          <p className="preview-description">{projectDescription}</p>

          {/* STATS */}

          <div className="preview-stats">
            {/* PROJECT OWNERSHIP / TEAM */}

            <div className="preview-stat-card active">
              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <Users size={17} />
                </div>

                <strong>
                  {isCompanyAdmin || isCompanyHR
                    ? "Independent project"
                    : selectedTeam
                      ? selectedTeam.name
                      : "Select a team"}
                </strong>
              </div>

              <span className="preview-stat-label">
                {isCompanyAdmin
                  ? selectedHR
                    ? `Assigned HR: ${selectedHR.name}`
                    : "HR assignment required"
                  : isCompanyHR
                    ? selectedTeamLeader
                      ? `Assigned Team Leader: ${selectedTeamLeader.name}`
                      : "Team Leader assignment required"
                    : selectedTeam
                      ? "Selected team"
                      : "Workspace team"}
              </span>

              <div className="preview-team-members">
                <span className="member-avatar">
                  {isCompanyAdmin
                    ? selectedHR?.name?.charAt(0)?.toUpperCase() || "H"
                    : isCompanyHR
                      ? selectedTeamLeader?.name?.charAt(0)?.toUpperCase() ||
                        "T"
                      : selectedTeam?.name?.charAt(0)?.toUpperCase() || "T"}
                </span>

                <span className="member-avatar member-avatar-two">+</span>
              </div>
            </div>

            {/* TASKS */}

            <div className="preview-stat-card">
              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <CheckSquare size={17} />
                </div>

                <strong>0 Tasks</strong>
              </div>

              <span className="preview-stat-label">
                Active 0 &nbsp;&nbsp; Completed 0
              </span>

              <button type="button" className="preview-small-button">
                <Plus size={13} />
                Create task
              </button>
            </div>

            {/* MILESTONES */}

            <div className="preview-stat-card">
              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <Flag size={17} />
                </div>

                <strong>0 Milestones</strong>
              </div>

              <div className="preview-mini-stats">
                <span>
                  Upcoming
                  <b>0</b>
                </span>

                <span>
                  Overdue
                  <b>0</b>
                </span>
              </div>
            </div>

            {/* RESOURCES */}

            <div className="preview-stat-card">
              <div className="preview-stat-top">
                <div className="preview-stat-icon">
                  <FileText size={17} />
                </div>

                <strong>0 Resources</strong>
              </div>

              <div className="preview-mini-stats">
                <span>
                  Docs
                  <b>0</b>
                </span>

                <span>
                  Links
                  <b>0</b>
                </span>
              </div>
            </div>
          </div>

          {/* TIMELINE */}

          <div className="preview-timeline">
            <div className="timeline-header">
              <div>
                <CalendarDays size={14} />
                <span>Timeline</span>
              </div>

              <span className="timeline-menu">•••</span>
            </div>

            <div className="timeline-dates">
              <span>Sept 2026</span>
              <span>Oct 2026</span>
              <span>Nov 2026</span>
              <span>Dec 2026</span>
              <span>Jan 2027</span>
            </div>

            <div className="timeline-track">
              <div className="timeline-line" />
              <div className="timeline-progress" />

              <span className="timeline-dot dot-one" />
              <span className="timeline-dot dot-two" />
              <span className="timeline-dot dot-three" />
            </div>

            <div className="timeline-footer">
              <span>Roadmap</span>
              <span>Jun 2026</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CreateProject;
