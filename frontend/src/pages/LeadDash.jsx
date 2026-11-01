import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock3,
  FolderKanban,
  KeyRound,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";

import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/LeadDash.css";

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    activeWorkspace,
    workspaceId,
    workspaceName,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [selectedMember, setSelectedMember] = useState(null);
  const [showMessagePanel, setShowMessagePanel] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ============================================================
  // INVITE MEMBER PAGE STATE
  // ============================================================

  const [showInviteMemberPage, setShowInviteMemberPage] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "USER",
    projectId: "",
  });

  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteAccountCreated, setInviteAccountCreated] = useState(false);

  // Retains the temporary password only in component memory
  // so invitation delivery can be retried if email sending fails.
  const [inviteDeliveryPassword, setInviteDeliveryPassword] = useState("");

  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  // ============================================================
  // INVITATION OVERVIEW AND CLICKABLE DETAILS
  // ============================================================

  const [invitationCounts, setInvitationCounts] = useState({
    pending: 0,
    accepted: 0,
  });

  const [invitationList, setInvitationList] = useState([]);
  const [invitationCountsLoading, setInvitationCountsLoading] = useState(false);
  const [invitationCountsError, setInvitationCountsError] = useState("");
  const [showInvitationDetailsPage, setShowInvitationDetailsPage] =
    useState(false);
  const [invitationRefreshKey, setInvitationRefreshKey] = useState(0);

  /*
   * Permissions come from the active workspace membership,
   * not from users.role.
   */
  const normalizedWorkspaceRole = String(workspaceRole || "")
    .trim()
    .toUpperCase();

  const normalizedWorkspaceType = String(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "INDIVIDUAL",
  )
    .trim()
    .toUpperCase();

  const normalizedWorkspaceRoles = [
    normalizedWorkspaceRole,
    ...(Array.isArray(activeWorkspace?.roles) ? activeWorkspace.roles : []),
  ]
    .map((role) =>
      String(role || "")
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean);

  const canManageIndividualWorkspace =
    normalizedWorkspaceType === "INDIVIDUAL" &&
    normalizedWorkspaceRoles.includes("TEAM_LEADER");

  const canInviteIndividualMembers = canManageIndividualWorkspace;

  // ============================================================
  // OPEN THE INVITATION FORM WHEN ARRIVING FROM THE TEAMS PAGE
  // ============================================================

  useEffect(() => {
    if (searchParams.get("openInvite") !== "1") {
      return;
    }

    if (workspaceLoading || loading) {
      return;
    }

    if (!canInviteIndividualMembers) {
      setError("Only an Individual workspace Team Leader can invite members.");
    } else {
      handleOpenInviteMemberPage();
    }

    setSearchParams(
      (currentParams) => {
        const nextParams = new URLSearchParams(currentParams);
        nextParams.delete("openInvite");
        return nextParams;
      },
      { replace: true },
    );
  }, [
    searchParams,
    setSearchParams,
    workspaceLoading,
    loading,
    canInviteIndividualMembers,
    projects.length,
  ]);

  // ============================================================
  // LOAD EXISTING WORKSPACE DATA
  // ============================================================

  useEffect(() => {
    if (workspaceLoading) {
      return;
    }

    if (!workspaceId) {
      setProjects([]);
      setTasks([]);
      setTeamMembers([]);
      setTeamMemberCount(0);
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [projectsData, userData, teamsData, tasksData] =
          await Promise.all([
            apiRequest(
              `/workspaces/individual/${encodeURIComponent(workspaceId)}/projects`,
            ),
            getCurrentUser(),
            getTeams(),
            getTasks(),
          ]);

        if (cancelled) {
          return;
        }

        // Support both plain-array responses and common wrapped API responses.
        const loadedProjectsRaw = Array.isArray(projectsData)
          ? projectsData
          : Array.isArray(projectsData?.projects)
            ? projectsData.projects
            : Array.isArray(projectsData?.data)
              ? projectsData.data
              : Array.isArray(projectsData?.data?.projects)
                ? projectsData.data.projects
                : [];

        const loadedTeamsRaw = Array.isArray(teamsData)
          ? teamsData
          : Array.isArray(teamsData?.teams)
            ? teamsData.teams
            : Array.isArray(teamsData?.data)
              ? teamsData.data
              : Array.isArray(teamsData?.data?.teams)
                ? teamsData.data.teams
                : [];

        const loadedTasksRaw = Array.isArray(tasksData)
          ? tasksData
          : Array.isArray(tasksData?.tasks)
            ? tasksData.tasks
            : Array.isArray(tasksData?.data)
              ? tasksData.data
              : Array.isArray(tasksData?.data?.tasks)
                ? tasksData.data.tasks
                : [];

        // Normalize common API field-name variants before filtering.
        const loadedProjects = loadedProjectsRaw.map((project) => ({
          ...project,
          id: project.id ?? project.project_id ?? project.projectId,
          team_id: project.team_id ?? project.teamId ?? project.team?.id,
          workspace_id:
            project.workspace_id ??
            project.workspaceId ??
            project.workspace?.id,
          name: project.name ?? project.title,
        }));

        const loadedTeams = loadedTeamsRaw.map((team) => ({
          ...team,
          id: team.id ?? team.team_id ?? team.teamId,
          workspace_id:
            team.workspace_id ?? team.workspaceId ?? team.workspace?.id,
        }));

        const loadedTasks = loadedTasksRaw.map((task) => ({
          ...task,
          project_id: task.project_id ?? task.projectId ?? task.project?.id,
        }));

        // Find teams associated with the active workspace.
        const workspaceTeams = loadedTeams.filter(
          (team) =>
            team.workspace_id !== null &&
            team.workspace_id !== undefined &&
            Number(team.workspace_id) === Number(workspaceId),
        );

        const workspaceTeamIds = new Set(
          workspaceTeams
            .map((team) => Number(team.id))
            .filter((id) => Number.isFinite(id)),
        );

        /*
         * The dedicated workspace endpoint has already scoped these projects
         * using teams.workspace_id after verifying workspace membership.
         * Keep that authoritative list for the dashboard and invite form.
         */
        const workspaceProjects = loadedProjects;

        const workspaceProjectIds = new Set(
          workspaceProjects
            .map((project) => Number(project.id))
            .filter((id) => Number.isFinite(id)),
        );

        // Scope tasks through their projects.
        const workspaceTasks = loadedTasks.filter((task) =>
          workspaceProjectIds.has(Number(task.project_id)),
        );

        setProjects(workspaceProjects);
        setUser(userData);
        setTasks(workspaceTasks);

        let totalMembers = 0;
        let allMembers = [];

        await Promise.all(
          workspaceTeams.map(async (team) => {
            try {
              const members = await getTeamMembers(team.id);

              if (Array.isArray(members)) {
                totalMembers += members.length;

                allMembers = [
                  ...allMembers,
                  ...members.map((member) => ({
                    ...member,
                    teamId: team.id,
                    teamName: team.name,
                  })),
                ];
              }
            } catch (memberError) {
              console.error(
                `Failed to load members for team ${team.id}:`,
                memberError,
              );
            }
          }),
        );

        if (cancelled) {
          return;
        }

        const uniqueMembers = Array.from(
          new Map(
            allMembers.map((member) => [member.id ?? member.user_id, member]),
          ).values(),
        );

        setTeamMemberCount(totalMembers);
        setTeamMembers(uniqueMembers);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Dashboard loading error:", loadError);

          setError(loadError.message || "Failed to load dashboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading]);

  // ============================================================
  // LOAD INVITATION COUNTS AND DETAILS
  // ============================================================

  useEffect(() => {
    if (workspaceLoading) {
      return;
    }

    if (!workspaceId || !canInviteIndividualMembers || showInviteMemberPage) {
      return;
    }

    let cancelled = false;

    async function loadInvitationData(showLoading = true) {
      if (showLoading) {
        setInvitationCountsLoading(true);
      }

      setInvitationCountsError("");

      try {
        const response = await apiRequest(
          `/workspaces/individual/${encodeURIComponent(workspaceId)}/invitations`,
        );

        const counts = response?.counts ?? response?.data?.counts;
        const invitations =
          response?.invitations ?? response?.data?.invitations;

        if (!counts || !Array.isArray(invitations)) {
          throw new Error("The server returned incomplete invitation details.");
        }

        if (!cancelled) {
          setInvitationCounts({
            pending: Number(counts.pending) || 0,
            accepted: Number(counts.accepted) || 0,
          });

          setInvitationList(invitations);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error("Invitation overview loading error:", loadError);

          setInvitationCountsError(
            loadError.message || "Unable to load invitation details.",
          );
        }
      } finally {
        if (!cancelled && showLoading) {
          setInvitationCountsLoading(false);
        }
      }
    }

    loadInvitationData(true);

    const refreshInterval = window.setInterval(() => {
      loadInvitationData(false);
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [
    workspaceId,
    workspaceLoading,
    canInviteIndividualMembers,
    showInviteMemberPage,
    invitationRefreshKey,
  ]);

  // ============================================================
  // INVITE MEMBER PAGE ACTIONS
  // ============================================================

  function handleOpenInviteMemberPage() {
    if (!canInviteIndividualMembers) {
      setError(
        "Only the Team Leader of an Individual workspace can invite members.",
      );
      return;
    }

    if (loading || workspaceLoading) {
      return;
    }

    setInviteError("");
    setInviteSuccess("");
    setInviteAccountCreated(false);
    setInviteDeliveryPassword("");

    setInviteForm({
      name: "",
      email: "",
      password: "",
      role: "USER",
      projectId: projects.length > 0 ? String(projects[0].id) : "",
    });

    setShowInitialPassword(false);
    setShowInviteMemberPage(true);
  }

  function handleInviteFormChange(event) {
    const { name, value } = event.target;

    // Use a nonstandard input name for the initial password so browsers are
    // less likely to mistake this invite form for a normal login form.
    const stateFieldName =
      name === "member-initial-secret"
        ? "password"
        : name === "invite-email-entry"
          ? "email"
          : name;

    setInviteForm((previous) => ({
      ...previous,
      [stateFieldName]: value,
    }));

    setInviteError("");
    setInviteSuccess("");
  }

  function handleReturnToLeadDash() {
    if (inviteSubmitting) {
      return;
    }

    setShowInviteMemberPage(false);
    setInviteError("");
    setInviteSuccess("");
    setInviteAccountCreated(false);
    setInviteDeliveryPassword("");
  }

  async function handleCreateMemberAndSendInvitation(event) {
    event.preventDefault();

    if (inviteSubmitting) {
      return;
    }

    if (!canInviteIndividualMembers) {
      setInviteError(
        "You do not have permission to invite members to this workspace.",
      );
      return;
    }

    if (!workspaceId) {
      setInviteError("The active workspace could not be identified.");
      return;
    }

    const cleanName = inviteForm.name.trim();
    const cleanEmail = inviteForm.email.trim().toLowerCase();
    const initialPassword = inviteForm.password;

    // On a retry, use the temporary password retained in memory.
    // On the first attempt, use the password currently in the form.
    const temporaryPasswordForEmail = inviteAccountCreated
      ? inviteDeliveryPassword
      : initialPassword;

    const assignedRole = inviteForm.role.trim().toUpperCase();
    const assignedProjectId = Number(inviteForm.projectId);

    if (cleanName.length < 2) {
      setInviteError("Please enter the member's full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    /*
     * If the account was already created but invitation sending
     * failed, don't attempt to create the same account again.
     */
    if (!inviteAccountCreated && initialPassword.length < 8) {
      setInviteError(
        "The initial password must contain at least 8 characters.",
      );
      return;
    }

    if (
      !inviteAccountCreated &&
      new TextEncoder().encode(initialPassword).length > 72
    ) {
      setInviteError("The initial password must not exceed 72 bytes.");
      return;
    }

    // A retry requires the original temporary password.
    // Never attempt to send an invitation without it.
    if (inviteAccountCreated && !temporaryPasswordForEmail) {
      setInviteError(
        "The temporary password is no longer available. Please use the account recovery process before sending another invitation.",
      );
      return;
    }

    if (!["USER", "TEAM_LEADER"].includes(assignedRole)) {
      setInviteError("Please select a valid Individual workspace role.");
      return;
    }

    if (!Number.isInteger(assignedProjectId) || assignedProjectId <= 0) {
      setInviteError("Please select a project for this member.");
      return;
    }

    const selectedProject = projects.find(
      (project) => Number(project.id) === assignedProjectId,
    );

    if (!selectedProject) {
      setInviteError(
        "The selected project is not part of the active workspace.",
      );
      return;
    }

    let accountCreated = inviteAccountCreated;

    try {
      setInviteSubmitting(true);
      setInviteError("");
      setInviteSuccess("");

      /*
       * STEP 1: Create the account.
       *
       * The existing backend route sets must_change_password = TRUE.
       * It does not create workspace membership at this stage.
       *
       * Skip this step when retrying an invitation for an account
       * that was created successfully during an earlier attempt.
       */
      if (!accountCreated) {
        await apiRequest("/users/individual-account", {
          method: "POST",
          body: JSON.stringify({
            name: cleanName,
            email: cleanEmail,
            password: initialPassword,
            role: assignedRole,
            workspaceId: Number(workspaceId),
          }),
        });

        accountCreated = true;

        setInviteAccountCreated(true);

        // Keep the password temporarily for invitation email delivery
        // and retries if sending the email fails.
        setInviteDeliveryPassword(initialPassword);

        // Remove the password from the visible form.
        setInviteForm((previous) => ({
          ...previous,
          password: "",
        }));
      }

      /*
       * STEP 2: Create the pending workspace invitation.
       *
       * projectId is sent to the backend. The backend must validate
       * and persist this assignment and link the member to its project
       * only when the invitation is accepted.
       */
      await apiRequest(
        `/workspaces/individual/${encodeURIComponent(workspaceId)}/invitations`,
        {
          method: "POST",
          body: JSON.stringify({
            email: cleanEmail,
            role: assignedRole,
            projectId: assignedProjectId,
            temporaryPassword: temporaryPasswordForEmail,
          }),
        },
      );

      setInviteSuccess(
        `The account for ${cleanName} was created and an invitation was sent for ${cleanEmail}. Assigned role: ${assignedRole}. Selected project: ${selectedProject.name || selectedProject.title || `Project ${selectedProject.id}`}.`,
      );

      setInvitationRefreshKey((current) => current + 1);
      setInviteAccountCreated(false);

      // Email delivery succeeded, so clear the temporary password.
      setInviteDeliveryPassword("");

      setInviteForm((previous) => ({
        ...previous,
        password: "",
      }));

      setShowInitialPassword(false);
    } catch (requestError) {
      console.error("Individual member invitation error:", requestError);

      if (accountCreated) {
        /*
         * The account exists now. Lock its details so the Team Leader
         * can retry the invitation without creating the account again
         * or changing the role/project attached to this attempt.
         */
        setInviteAccountCreated(true);

        setInviteError(
          `The account for ${cleanEmail} was created, but the invitation could not be completed. Use Retry Sending Invitation below. Invitation error: ${requestError.message || "Unknown error"}`,
        );
      } else {
        setInviteError(
          requestError.message ||
            "Unable to create the member account. Please try again.",
        );
      }
    } finally {
      setInviteSubmitting(false);
    }
  }

  // ============================================================
  // TASK HELPERS
  // ============================================================

  function getTaskId(task) {
    return task?.id ?? task?.task_id;
  }

  function getTaskProjectId(task) {
    return task?.project_id ?? task?.projectId;
  }

  function getTaskTitle(task) {
    return task?.title || task?.name || "Untitled task";
  }

  function getTaskDescription(task) {
    return task?.description || "";
  }

  function getNormalizedStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function getTaskColumn(task) {
    const status = getNormalizedStatus(task.status);

    if (["completed", "complete", "done"].includes(status)) {
      return "completed";
    }

    if (["in_progress", "active", "doing"].includes(status)) {
      return "in_progress";
    }

    if (["blocked", "on_hold"].includes(status)) {
      return "blocked";
    }

    return "todo";
  }

  function getDisplayStatus(status) {
    const normalizedStatus = getNormalizedStatus(status);

    switch (normalizedStatus) {
      case "in_progress":
        return "In Progress";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "blocked":
      case "on_hold":
        return "Blocked";

      case "pending":
      case "todo":
      case "to_do":
        return "To Do";

      case "active":
      case "doing":
        return "In Progress";

      default:
        return status || "To Do";
    }
  }

  function isCompleted(task) {
    return getTaskColumn(task) === "completed";
  }

  function getTaskDueDate(task) {
    const value =
      task?.due_date ??
      task?.deadline ??
      task?.dueDate ??
      task?.due_at ??
      task?.end_date;

    if (!value) {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getStartOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isOverdue(task) {
    const dueDate = getTaskDueDate(task);

    if (!dueDate || isCompleted(task)) {
      return false;
    }

    return getStartOfDay(dueDate) < getStartOfDay(new Date());
  }

  function getDueLabel(task) {
    const dueDate = getTaskDueDate(task);

    if (!dueDate) {
      return "No deadline";
    }

    const dueDay = getStartOfDay(dueDate);
    const today = getStartOfDay(new Date());

    const daysDifference = Math.round(
      (dueDay.getTime() - today.getTime()) / 86400000,
    );

    if (daysDifference < 0) {
      const daysLate = Math.abs(daysDifference);

      return `Overdue by ${daysLate} day${daysLate === 1 ? "" : "s"}`;
    }

    if (daysDifference === 0) {
      return "Due today";
    }

    if (daysDifference === 1) {
      return "Tomorrow";
    }

    return dueDate.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  }

  function openTask(task) {
    const taskId = getTaskId(task);
    const projectId = getTaskProjectId(task);

    if (taskId !== undefined && taskId !== null && projectId) {
      navigate(`/projects/${projectId}/tasks/${taskId}`);
      return;
    }

    navigate("/tasks");
  }

  function openProject(project) {
    if (project?.id !== undefined && project?.id !== null) {
      navigate(`/projects/${project.id}`);
      return;
    }

    navigate("/projects");
  }

  // ============================================================
  // SEARCH AND DASHBOARD DATA
  // ============================================================

  const normalizedSearch = searchQuery.trim().toLowerCase();

  function matchesSearch(item) {
    if (!normalizedSearch) {
      return true;
    }

    const searchableText = [
      item?.title,
      item?.name,
      item?.description,
      item?.teamName,
      item?.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  }

  const filteredProjects = projects.filter(matchesSearch);
  const filteredTasks = tasks.filter(matchesSearch);

  const toDoTasks = filteredTasks.filter(
    (task) => getTaskColumn(task) === "todo",
  );

  const inProgressTasks = filteredTasks.filter(
    (task) => getTaskColumn(task) === "in_progress",
  );

  const completedTasks = filteredTasks.filter(
    (task) => getTaskColumn(task) === "completed",
  );

  const activeTaskCount = tasks.filter(
    (task) => getTaskColumn(task) === "in_progress",
  ).length;

  const blockedTasks = tasks.filter(
    (task) => getTaskColumn(task) === "blocked",
  );

  const completedTaskCount = tasks.filter(isCompleted).length;

  const projectProgress =
    tasks.length > 0
      ? Math.round((completedTaskCount / tasks.length) * 100)
      : null;

  const upcomingDeadlines = filteredTasks
    .filter((task) => {
      const dueDate = getTaskDueDate(task);

      return (
        dueDate &&
        !isCompleted(task) &&
        getStartOfDay(dueDate) >= getStartOfDay(new Date())
      );
    })
    .sort((a, b) => getTaskDueDate(a).getTime() - getTaskDueDate(b).getTime())
    .slice(0, 4);

  const actionRequired = Array.from(
    new Map(
      filteredTasks
        .filter((task) => getTaskColumn(task) === "blocked" || isOverdue(task))
        .map((task) => [getTaskId(task), task]),
    ).values(),
  ).slice(0, 4);

  const pendingInvitationRows = invitationList.filter(
    (invitation) => String(invitation.status || "").toUpperCase() === "PENDING",
  );

  const acceptedInvitationRows = invitationList.filter(
    (invitation) =>
      String(invitation.status || "").toUpperCase() === "ACCEPTED",
  );

  const currentDateLabel = new Date().toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  // ============================================================
  // TEAM MEMBER HELPERS
  // ============================================================

  function getMemberName(member) {
    return (
      member?.name ||
      member?.user_name ||
      member?.username ||
      member?.email ||
      "Team Member"
    );
  }

  function getMemberInitials(member) {
    return getMemberName(member)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }

  function handleMemberClick(member) {
    setSelectedMember(member);
    setShowMessagePanel(false);
  }

  function closeMemberDetails() {
    setSelectedMember(null);
    setShowMessagePanel(false);
  }

  function handleCreateTask() {
    if (projects.length === 1) {
      navigate(`/projects/${projects[0].id}/tasks/create`);
      return;
    }

    if (projects.length === 0) {
      navigate("/projects/create");
      return;
    }

    navigate("/projects");
  }

  // ============================================================
  // LOADING AND EMPTY WORKSPACE STATES
  // ============================================================

  if (workspaceLoading) {
    return (
      <main className="mc-dashboard">
        <section className="mc-state-panel">
          <span className="mc-eyebrow">MISSION CONTROL</span>

          <h2>Loading your workspace...</h2>

          <p>Preparing your ZYRA dashboard.</p>
        </section>
      </main>
    );
  }

  if (!activeWorkspace) {
    return (
      <main className="mc-dashboard">
        <section className="mc-state-panel">
          <span className="mc-eyebrow">MISSION CONTROL</span>

          <h2>No workspace selected</h2>

          <p>Select a workspace from the ZYRA navigation to continue.</p>
        </section>
      </main>
    );
  }

  // ============================================================
  // INVITE MEMBER PAGE
  // Rendered inside LeadDash.jsx; no extra page file is needed.
  // ============================================================

  if (showInviteMemberPage) {
    return (
      <main className="mc-dashboard">
        <style>{`
          .mc-invite-page {
            width: min(100%, 900px);
            margin: 0 auto;
            padding: 10px 0 50px;
            color: #e8f0fc;
          }

          .mc-invite-back {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 24px;
            padding: 8px 0;
            color: #a8b8cc;
            background: transparent;
            border: 0;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
          }

          .mc-invite-back:hover {
            color: #7be3ef;
          }

          .mc-invite-heading {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 27px;
          }

          .mc-invite-heading-icon {
            display: grid;
            place-items: center;
            width: 58px;
            height: 58px;
            flex: 0 0 auto;
            color: #7de4ee;
            background: rgba(70, 199, 219, 0.09);
            border: 1px solid rgba(82, 207, 224, 0.22);
            border-radius: 17px;
          }

          .mc-invite-eyebrow {
            color: #78dce7;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 2px;
          }

          .mc-invite-heading h1 {
            margin: 8px 0 8px;
            color: #f0f6ff;
            font-size: clamp(27px, 4vw, 36px);
            letter-spacing: -1px;
          }

          .mc-invite-heading p {
            max-width: 620px;
            margin: 0;
            color: #9aadc3;
            font-size: 13px;
            line-height: 1.8;
          }

          .mc-invite-card {
            padding: clamp(20px, 4vw, 32px);
            background: #0d1523;
            border: 1px solid rgba(124, 166, 197, 0.17);
            border-radius: 19px;
          }

          .mc-invite-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding-bottom: 20px;
            margin-bottom: 23px;
            border-bottom: 1px solid rgba(140, 171, 199, 0.12);
          }

          .mc-invite-card-header h2 {
            margin: 0 0 7px;
            color: #e9f2ff;
            font-size: 17px;
          }

          .mc-invite-card-header p {
            margin: 0;
            color: #8fa2b9;
            font-size: 12px;
            line-height: 1.7;
          }

          .mc-invite-form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 21px 18px;
          }

          .mc-invite-field {
            display: grid;
            gap: 9px;
            min-width: 0;
          }

          .mc-invite-field-full {
            grid-column: 1 / -1;
          }

          .mc-invite-field label {
            color: #d5e2f1;
            font-size: 12px;
            font-weight: 650;
          }

          .mc-invite-field input,
          .mc-invite-field select {
            width: 100%;
            min-width: 0;
            min-height: 47px;
            padding: 12px 13px;
            color: #edf5ff;
            background: #080f1a;
            border: 1px solid rgba(141, 172, 198, 0.19);
            border-radius: 10px;
            outline: none;
            font: inherit;
            font-size: 13px;
          }

          .mc-invite-field select {
            cursor: pointer;
          }

          .mc-invite-field input::placeholder {
            color: #5e7085;
          }

          .mc-invite-field input:focus,
          .mc-invite-field select:focus {
            border-color: rgba(101, 211, 229, 0.6);
            box-shadow: 0 0 0 3px rgba(52, 173, 200, 0.08);
          }

          .mc-invite-field input:-webkit-autofill,
          .mc-invite-field input:-webkit-autofill:hover,
          .mc-invite-field input:-webkit-autofill:focus,
          .mc-invite-field input:-webkit-autofill:active {
            -webkit-text-fill-color: #edf5ff !important;
            -webkit-box-shadow: 0 0 0 1000px #080f1a inset !important;
            box-shadow: 0 0 0 1000px #080f1a inset !important;
            caret-color: #edf5ff;
            transition: background-color 9999s ease-out 0s;
          }

          .mc-invite-password-wrap input:-webkit-autofill,
          .mc-invite-password-wrap input:-webkit-autofill:hover,
          .mc-invite-password-wrap input:-webkit-autofill:focus,
          .mc-invite-password-wrap input:-webkit-autofill:active {
            -webkit-text-fill-color: #edf5ff !important;
            -webkit-box-shadow: 0 0 0 1000px #080f1a inset !important;
            box-shadow: 0 0 0 1000px #080f1a inset !important;
            caret-color: #edf5ff;
            transition: background-color 9999s ease-out 0s;
          }

          .mc-invite-field input:disabled,
          .mc-invite-field select:disabled {
            opacity: 0.65;
          }

          .mc-invite-field-help {
            color: #7f93aa;
            font-size: 11px;
            line-height: 1.6;
          }

          .mc-invite-password-wrap {
            display: flex;
            align-items: center;
            gap: 10px;
            padding-right: 8px;
            background: #080f1a;
            border: 1px solid rgba(141, 172, 198, 0.19);
            border-radius: 10px;
          }

          .mc-invite-password-wrap:focus-within {
            border-color: rgba(101, 211, 229, 0.6);
            box-shadow: 0 0 0 3px rgba(52, 173, 200, 0.08);
          }

          .mc-invite-password-wrap input {
            flex: 1;
            width: 100%;
            min-width: 0;
            background: transparent;
            border: 0;
            box-shadow: none;
          }

          .mc-invite-password-wrap input:focus {
            border-color: transparent;
            box-shadow: none;
          }

          .mc-invite-password-toggle {
            display: grid;
            place-items: center;
            width: 36px;
            height: 38px;
            flex: 0 0 auto;
            color: #9bafc4;
            background: transparent;
            border: 0;
            cursor: pointer;
          }

          .mc-invite-callout {
            display: flex;
            align-items: flex-start;
            gap: 11px;
            margin-top: 23px;
            padding: 15px;
            color: #bed2e4;
            background: rgba(80, 194, 217, 0.055);
            border: 1px solid rgba(80, 194, 217, 0.16);
            border-radius: 12px;
            font-size: 12px;
            line-height: 1.75;
          }

          .mc-invite-callout svg {
            flex: 0 0 auto;
            margin-top: 2px;
            color: #7bdfe8;
          }

          .mc-invite-message {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 20px;
            padding: 14px 15px;
            border-radius: 11px;
            font-size: 12px;
            line-height: 1.75;
            overflow-wrap: anywhere;
          }

          .mc-invite-message svg {
            flex: 0 0 auto;
            margin-top: 2px;
          }

          .mc-invite-message-error {
            color: #ffbdc3;
            background: rgba(244, 63, 94, 0.08);
            border: 1px solid rgba(244, 63, 94, 0.22);
          }

          .mc-invite-message-success {
            color: #aaf1d6;
            background: rgba(52, 211, 153, 0.07);
            border: 1px solid rgba(52, 211, 153, 0.21);
          }

          .mc-invite-actions {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-end;
            gap: 11px;
            padding-top: 25px;
            margin-top: 24px;
            border-top: 1px solid rgba(140, 171, 199, 0.12);
          }

          .mc-invite-cancel,
          .mc-invite-submit {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 9px;
            min-height: 46px;
            padding: 12px 18px;
            border-radius: 10px;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .mc-invite-cancel {
            color: #c6d4e5;
            background: rgba(255, 255, 255, 0.035);
            border: 1px solid rgba(140, 171, 199, 0.2);
          }

          .mc-invite-submit {
            color: #07171d;
            background: linear-gradient(100deg, #8cecf1, #54d3df);
            border: 0;
          }

          .mc-invite-submit:disabled,
          .mc-invite-cancel:disabled {
            opacity: 0.62;
            cursor: wait;
          }

          .mc-invite-no-projects {
            margin-top: 9px;
            color: #ffcf9f;
            font-size: 11px;
            line-height: 1.7;
          }

          .mc-invite-button-spinner {
            width: 15px;
            height: 15px;
            border: 2px solid rgba(7, 23, 29, 0.25);
            border-top-color: #07171d;
            border-radius: 50%;
            animation: mcInviteSpin 700ms linear infinite;
          }

          @keyframes mcInviteSpin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .mc-invite-button-spinner {
              animation: none;
            }
          }

          @media (max-width: 640px) {
            .mc-invite-form-grid {
              grid-template-columns: minmax(0, 1fr);
            }

            .mc-invite-field-full {
              grid-column: auto;
            }

            .mc-invite-actions {
              flex-direction: column-reverse;
              align-items: stretch;
            }

            .mc-invite-cancel,
            .mc-invite-submit {
              width: 100%;
            }
          }
        `}</style>

        <div className="mc-invite-page">
          <button
            type="button"
            className="mc-invite-back"
            onClick={handleReturnToLeadDash}
            disabled={inviteSubmitting}
          >
            <ArrowLeft size={16} />
            Back to LeadDash
          </button>

          <header className="mc-invite-heading">
            <div className="mc-invite-heading-icon">
              <UserPlus size={27} />
            </div>

            <div>
              <span className="mc-invite-eyebrow">
                TEAM MANAGEMENT / ACCESS CONTROL
              </span>

              <h1>Invite a Member</h1>

              <p>
                Create the member's account, assign their workspace role and
                project, then send the invitation for them to review.
              </p>
            </div>
          </header>

          <section className="mc-invite-card">
            <div className="mc-invite-card-header">
              <div>
                <h2>Member Details</h2>

                <p>
                  Workspace:{" "}
                  <strong>{workspaceName || "Individual Workspace"}</strong>
                </p>
              </div>

              <Users size={20} />
            </div>

            {inviteError && (
              <div
                className="mc-invite-message mc-invite-message-error"
                role="alert"
              >
                <AlertCircle size={18} />
                <span>{inviteError}</span>
              </div>
            )}

            {inviteSuccess && (
              <div
                className="mc-invite-message mc-invite-message-success"
                role="status"
              >
                <CheckCircle2 size={18} />
                <span>{inviteSuccess}</span>
              </div>
            )}

            <form
              onSubmit={handleCreateMemberAndSendInvitation}
              autoComplete="off"
            >
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-10000px",
                  top: "-10000px",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                  opacity: 0,
                  pointerEvents: "none",
                }}
              >
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  tabIndex={-1}
                />
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  tabIndex={-1}
                />
              </div>

              <div className="mc-invite-form-grid">
                <div className="mc-invite-field">
                  <label htmlFor="invite-member-name">Full Name</label>

                  <input
                    id="invite-member-name"
                    name="name"
                    type="text"
                    value={inviteForm.name}
                    onChange={handleInviteFormChange}
                    placeholder="Enter member's full name"
                    autoComplete="off"
                    minLength={2}
                    required
                    disabled={
                      inviteSubmitting ||
                      inviteAccountCreated ||
                      Boolean(inviteSuccess)
                    }
                  />
                </div>

                <div className="mc-invite-field">
                  <label htmlFor="invite-member-email">Email Address</label>

                  <input
                    id="invite-member-email"
                    name="invite-email-entry"
                    type="text"
                    inputMode="email"
                    value={inviteForm.email}
                    onChange={handleInviteFormChange}
                    placeholder="member@example.com"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    required
                    disabled={
                      inviteSubmitting ||
                      inviteAccountCreated ||
                      Boolean(inviteSuccess)
                    }
                  />
                </div>

                <div className="mc-invite-field mc-invite-field-full">
                  <label htmlFor="invite-member-password">
                    Initial Password
                  </label>

                  <div className="mc-invite-password-wrap">
                    <KeyRound size={17} />

                    <input
                      id="invite-member-password"
                      name="member-initial-secret"
                      type="text"
                      value={inviteForm.password}
                      onChange={handleInviteFormChange}
                      placeholder="Create an initial password"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-bwignore="true"
                      data-form-type="other"
                      style={{
                        WebkitTextSecurity: showInitialPassword
                          ? "none"
                          : "disc",
                      }}
                      minLength={8}
                      required={!inviteAccountCreated && !inviteSuccess}
                      disabled={
                        inviteSubmitting ||
                        inviteAccountCreated ||
                        Boolean(inviteSuccess)
                      }
                    />

                    <button
                      type="button"
                      className="mc-invite-password-toggle"
                      onClick={() => setShowInitialPassword((value) => !value)}
                      disabled={
                        inviteSubmitting ||
                        inviteAccountCreated ||
                        Boolean(inviteSuccess)
                      }
                      aria-label={
                        showInitialPassword
                          ? "Hide initial password"
                          : "Show initial password"
                      }
                    >
                      {showInitialPassword ? (
                        <X size={17} />
                      ) : (
                        <ShieldCheck size={17} />
                      )}
                    </button>
                  </div>

                  <span className="mc-invite-field-help">
                    Minimum 8 characters. The member must change this password
                    after signing in for the first time.
                  </span>
                </div>

                <div className="mc-invite-field">
                  <label htmlFor="invite-member-role">Assigned Role</label>

                  <select
                    id="invite-member-role"
                    name="role"
                    value={inviteForm.role}
                    onChange={handleInviteFormChange}
                    required={!inviteAccountCreated && !inviteSuccess}
                    disabled={
                      inviteSubmitting ||
                      inviteAccountCreated ||
                      Boolean(inviteSuccess)
                    }
                  >
                    <option value="USER">User</option>
                    <option value="TEAM_LEADER">Team Leader</option>
                  </select>

                  <span className="mc-invite-field-help">
                    This role determines which Individual dashboard opens after
                    invitation acceptance.
                  </span>
                </div>

                <div className="mc-invite-field">
                  <label htmlFor="invite-member-project">
                    Assigned Project
                  </label>

                  <select
                    id="invite-member-project"
                    name="projectId"
                    value={inviteForm.projectId}
                    onChange={handleInviteFormChange}
                    required
                    disabled={
                      inviteSubmitting ||
                      inviteAccountCreated ||
                      Boolean(inviteSuccess) ||
                      projects.length === 0
                    }
                  >
                    <option value="">
                      {projects.length === 0
                        ? "No projects available"
                        : "Select a project"}
                    </option>

                    {projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {project.name ||
                          project.title ||
                          `Project ${project.id}`}
                      </option>
                    ))}
                  </select>

                  {projects.length === 0 && (
                    <span className="mc-invite-no-projects">
                      Create a project in this workspace before sending a
                      project-specific invitation.
                    </span>
                  )}
                </div>
              </div>

              <div className="mc-invite-callout">
                <ShieldCheck size={18} />

                <span>
                  The member's account is created with an initial-password
                  requirement. The invitation must remain pending until they
                  change their password and explicitly accept it. Workspace
                  membership and project membership must be created only after
                  acceptance.
                </span>
              </div>

              <div className="mc-invite-actions">
                <button
                  type="button"
                  className="mc-invite-cancel"
                  onClick={handleReturnToLeadDash}
                  disabled={inviteSubmitting}
                >
                  Cancel
                </button>

                {inviteSuccess ? (
                  <button
                    type="button"
                    className="mc-invite-submit"
                    onClick={handleReturnToLeadDash}
                  >
                    <CheckCircle2 size={17} />
                    Return to LeadDash
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="mc-invite-submit"
                    disabled={
                      inviteSubmitting || loading || projects.length === 0
                    }
                  >
                    {inviteSubmitting ? (
                      <>
                        <span className="mc-invite-button-spinner" />
                        {inviteAccountCreated
                          ? "Sending Invitation..."
                          : "Creating & Inviting..."}
                      </>
                    ) : (
                      <>
                        <Send size={17} />
                        {inviteAccountCreated
                          ? "Retry Sending Invitation"
                          : "Create Account & Send Invitation"}
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  // ============================================================
  // INVITATION DETAILS PAGE — SIDE-BY-SIDE STATUS COMPARISON
  // ============================================================

  if (showInvitationDetailsPage && canInviteIndividualMembers) {
    const renderInvitationEntry = (invitation, accepted) => {
      const inviteeName =
        invitation.invitee_name ||
        invitation.name ||
        invitation.invited_email ||
        "Invited Member";

      return (
        <article className="mc-invitation-entry" key={invitation.id}>
          <div className="mc-invitation-entry-top">
            <span
              className={`mc-invitation-entry-icon ${
                accepted ? "accepted" : "pending"
              }`}
            >
              {accepted ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
            </span>

            <span
              className={`mc-invitation-badge ${
                accepted ? "accepted" : "pending"
              }`}
            >
              {accepted ? "Accepted" : "Pending"}
            </span>
          </div>

          <h3>{inviteeName}</h3>

          <p className="mc-invitation-entry-email">
            {invitation.invited_email || "Email unavailable"}
          </p>

          <div className="mc-invitation-entry-meta">
            <span>Project</span>
            <strong>{invitation.project_name || "Workspace invitation"}</strong>
          </div>

          <div className="mc-invitation-entry-meta">
            <span>Role</span>
            <strong>
              {String(invitation.role || "USER").replaceAll("_", " ")}
            </strong>
          </div>

          {invitation.created_at && (
            <div className="mc-invitation-entry-date">
              Sent{" "}
              {new Date(invitation.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
          )}
        </article>
      );
    };

    return (
      <main className="mc-dashboard mc-invitation-details-page">
        <style>{`
          .mc-invitation-details-page {
            color: #eaf3ff;
          }

          .mc-invitation-details-shell {
            width: min(100%, 1180px);
            margin: 0 auto;
            padding: 10px 0 48px;
          }

          .mc-invitation-page-back {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin: 0 0 24px;
            padding: 8px 0;
            color: #a8b8cc;
            background: transparent;
            border: 0;
            font: inherit;
            font-size: 12px;
            cursor: pointer;
          }

          .mc-invitation-page-back:hover {
            color: #7be3ef;
          }

          .mc-invitation-page-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 25px;
          }

          .mc-invitation-page-heading h1 {
            margin: 7px 0 9px;
            color: #f0f6ff;
            font-size: clamp(27px, 4vw, 36px);
            letter-spacing: -1px;
          }

          .mc-invitation-page-heading p {
            max-width: 650px;
            margin: 0;
            color: #91a7be;
            font-size: 12px;
            line-height: 1.75;
          }

          .mc-invitation-refresh {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-height: 38px;
            padding: 9px 12px;
            color: #bfe7eb;
            background: rgba(100, 216, 223, 0.055);
            border: 1px solid rgba(100, 216, 223, 0.22);
            border-radius: 9px;
            font: inherit;
            font-size: 11px;
            font-weight: 650;
            cursor: pointer;
          }

          .mc-invitation-refresh:disabled {
            opacity: 0.65;
            cursor: wait;
          }

          .mc-invitation-details-error {
            margin: 0 0 16px;
            padding: 11px 13px;
            color: #ffc4cb;
            background: rgba(255, 95, 116, 0.06);
            border: 1px solid rgba(255, 95, 116, 0.18);
            border-radius: 10px;
            font-size: 11px;
            line-height: 1.6;
          }

          .mc-invitation-comparison {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            align-items: start;
          }

          .mc-invitation-comparison-column {
            min-width: 0;
            overflow: hidden;
            background: rgba(12, 21, 35, 0.82);
            border: 1px solid rgba(126, 163, 190, 0.16);
            border-radius: 16px;
          }

          .mc-invitation-comparison-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 17px 18px;
            background: rgba(255, 255, 255, 0.025);
            border-bottom: 1px solid rgba(126, 163, 190, 0.14);
          }

          .mc-invitation-comparison-heading h2 {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0;
            color: #e8f2ff;
            font-size: 13px;
            font-weight: 750;
          }

          .mc-invitation-comparison-heading.pending h2 svg {
            color: #f4c276;
          }

          .mc-invitation-comparison-heading.accepted h2 svg {
            color: #6fe0b4;
          }

          .mc-invitation-count-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            min-height: 28px;
            padding: 0 8px;
            color: #e8f5ff;
            background: rgba(111, 145, 172, 0.13);
            border: 1px solid rgba(126, 163, 190, 0.18);
            border-radius: 9px;
            font-size: 12px;
            font-weight: 800;
          }

          .mc-invitation-entry-list {
            display: grid;
            gap: 10px;
            padding: 12px;
          }

          .mc-invitation-entry {
            min-width: 0;
            padding: 14px;
            background: rgba(255, 255, 255, 0.025);
            border: 1px solid rgba(126, 163, 190, 0.13);
            border-radius: 12px;
          }

          .mc-invitation-entry-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 11px;
          }

          .mc-invitation-entry-icon {
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            border-radius: 10px;
          }

          .mc-invitation-entry-icon.pending {
            color: #f4c276;
            background: rgba(245, 158, 11, 0.09);
          }

          .mc-invitation-entry-icon.accepted {
            color: #6fe0b4;
            background: rgba(52, 211, 153, 0.08);
          }

          .mc-invitation-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 750;
          }

          .mc-invitation-badge.pending {
            color: #ffd59a;
            background: rgba(245, 158, 11, 0.09);
            border: 1px solid rgba(245, 158, 11, 0.19);
          }

          .mc-invitation-badge.accepted {
            color: #9ceacb;
            background: rgba(52, 211, 153, 0.08);
            border: 1px solid rgba(52, 211, 153, 0.17);
          }

          .mc-invitation-entry h3 {
            margin: 0 0 5px;
            color: #eaf3ff;
            font-size: 13px;
            line-height: 1.5;
            overflow-wrap: anywhere;
          }

          .mc-invitation-entry-email {
            margin: 0 0 15px;
            color: #8fa5bb;
            font-size: 11px;
            line-height: 1.6;
            overflow-wrap: anywhere;
          }

          .mc-invitation-entry-meta {
            display: flex;
            flex-wrap: wrap;
            align-items: baseline;
            justify-content: space-between;
            gap: 5px 12px;
            padding-top: 9px;
            margin-top: 9px;
            border-top: 1px solid rgba(126, 163, 190, 0.1);
            font-size: 10px;
          }

          .mc-invitation-entry-meta span,
          .mc-invitation-entry-date {
            color: #8299b0;
          }

          .mc-invitation-entry-meta strong {
            color: #c8d8e9;
            font-weight: 650;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .mc-invitation-entry-date {
            margin-top: 12px;
            font-size: 10px;
          }

          .mc-invitation-details-empty {
            padding: 25px 18px;
            color: #8fa5bb;
            text-align: center;
            font-size: 11px;
            line-height: 1.75;
          }

          @media (max-width: 720px) {
            .mc-invitation-comparison {
              grid-template-columns: minmax(0, 1fr);
            }

            .mc-invitation-page-heading {
              align-items: flex-start;
            }
          }

          @media (max-width: 480px) {
            .mc-invitation-page-heading {
              flex-direction: column;
            }

            .mc-invitation-refresh {
              align-self: flex-start;
            }
          }
        `}</style>

        <section className="mc-invitation-details-shell">
          <button
            type="button"
            className="mc-invitation-page-back"
            onClick={() => setShowInvitationDetailsPage(false)}
          >
            <ArrowLeft size={15} />
            Back to Mission Control
          </button>

          <div className="mc-invitation-page-heading">
            <div>
              <span className="mc-eyebrow">ACCESS CONTROL / TEAM STATUS</span>
              <h1>Invitation Details</h1>
              <p>
                Compare invitations that are awaiting a response with
                invitations that members have accepted. Each entry includes the
                member, email, project, and role.
              </p>
            </div>

            <button
              type="button"
              className="mc-invitation-refresh"
              onClick={() => setInvitationRefreshKey((current) => current + 1)}
              disabled={invitationCountsLoading}
              title="Refresh invitation status"
            >
              <RefreshCw size={14} />
              {invitationCountsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {invitationCountsError && (
            <p className="mc-invitation-details-error" role="alert">
              {invitationCountsError}
            </p>
          )}

          {invitationCountsLoading && invitationList.length === 0 ? (
            <div className="mc-invitation-details-empty">
              Loading invitation records...
            </div>
          ) : (
            <div className="mc-invitation-comparison" aria-live="polite">
              <section
                className="mc-invitation-comparison-column"
                aria-labelledby="mc-pending-column-heading"
              >
                <div className="mc-invitation-comparison-heading pending">
                  <h2 id="mc-pending-column-heading">
                    <Clock3 size={16} /> Pending Invitations
                  </h2>

                  <span className="mc-invitation-count-pill">
                    {invitationCounts.pending}
                  </span>
                </div>

                {pendingInvitationRows.length === 0 ? (
                  <div className="mc-invitation-details-empty">
                    No pending invitations right now.
                  </div>
                ) : (
                  <div className="mc-invitation-entry-list">
                    {pendingInvitationRows.map((invitation) =>
                      renderInvitationEntry(invitation, false),
                    )}
                  </div>
                )}
              </section>

              <section
                className="mc-invitation-comparison-column"
                aria-labelledby="mc-accepted-column-heading"
              >
                <div className="mc-invitation-comparison-heading accepted">
                  <h2 id="mc-accepted-column-heading">
                    <CheckCircle2 size={16} /> Accepted Invitations
                  </h2>

                  <span className="mc-invitation-count-pill">
                    {invitationCounts.accepted}
                  </span>
                </div>

                {acceptedInvitationRows.length === 0 ? (
                  <div className="mc-invitation-details-empty">
                    No accepted invitations yet.
                  </div>
                ) : (
                  <div className="mc-invitation-entry-list">
                    {acceptedInvitationRows.map((invitation) =>
                      renderInvitationEntry(invitation, true),
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    );
  }

  // ============================================================
  // MAIN MISSION CONTROL DASHBOARD
  // ============================================================

  return (
    <main className="mc-dashboard">
      {/* HEADER */}

      <header className="mc-header">
        <div className="mc-header-copy">
          <span className="mc-eyebrow">
            {workspaceName || "ZYRA WORKSPACE"}
            {workspaceRole ? ` / ${workspaceRole}` : ""}
          </span>

          <h1>
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
                ? "afternoon"
                : "evening"}
            , {user?.name || "there"}
          </h1>

          <p>Here's your team's focus for today.</p>
        </div>

        <div className="mc-header-actions">
          {canManageIndividualWorkspace && (
            <button
              type="button"
              className="mc-primary-action"
              onClick={() => navigate("/teams/create")}
              disabled={loading || workspaceLoading}
              title="Create a team in your Individual workspace"
            >
              <Users size={17} />
              <span>Create Team</span>
            </button>
          )}

          {canManageIndividualWorkspace && (
            <button
              type="button"
              className="mc-primary-action"
              onClick={() => navigate("/projects/create")}
              disabled={loading || workspaceLoading}
              title="Create a new project in this Individual workspace"
            >
              <FolderKanban size={17} />
              <span>Create Project</span>
            </button>
          )}
          <button
            type="button"
            className="mc-primary-action"
            onClick={handleCreateTask}
            title={
              projects.length > 1
                ? "Choose a project before creating a task"
                : "Create a new task"
            }
          >
            <Plus size={17} />
            <span>New Task</span>
          </button>

          <button
            type="button"
            className="mc-icon-button"
            onClick={() => navigate("/notifications")}
            aria-label="Open notifications"
            title="Notifications"
          >
            <Bell size={17} />
          </button>

          <button
            type="button"
            className="mc-icon-button"
            onClick={() => navigate("/ai-assistant")}
            aria-label="Open AI Assistant"
            title="ZYRA AI Assistant"
          >
            <Sparkles size={17} />
          </button>

          <label className="mc-search">
            <Search size={16} />

            <input
              type="search"
              placeholder="Search workspace"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search projects and tasks"
            />
          </label>

          <div className="mc-date-chip">
            <CalendarDays size={15} />
            <span>{currentDateLabel}</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="mc-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================
          COMPACT TOP STATISTICS
          Total Projects + Project Progress + Active Tasks
          + Blocked Tasks + Team Members
          ======================================================== */}

      <style>{`
        .mc-dashboard .mc-stats-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .mc-dashboard .mc-stat-card {
          min-width: 0;
          min-height: 106px;
          padding: 12px 11px;
          gap: 8px;
        }

        .mc-dashboard .mc-stat-top {
          gap: 6px;
          font-size: 11px;
          line-height: 1.25;
        }

        .mc-dashboard .mc-stat-top > span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .mc-dashboard .mc-stat-top svg {
          width: 15px;
          height: 15px;
          flex: 0 0 auto;
        }

        .mc-dashboard .mc-stat-value {
          font-size: 25px;
          line-height: 1.05;
        }

        .mc-dashboard .mc-stat-caption {
          font-size: 10px;
          line-height: 1.35;
        }

        .mc-dashboard .mc-progress-stat-content {
          gap: 7px;
        }

        .mc-dashboard .mc-progress-ring {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
        }

        .mc-dashboard .mc-progress-ring span {
          font-size: 9px;
        }

        /* Highlight Total Projects */
        .mc-dashboard .mc-total-projects-stat {
          border-color: rgba(82, 221, 220, 0.3);
          background: linear-gradient(
            145deg,
            rgba(43, 192, 197, 0.12),
            rgba(16, 25, 43, 0.96) 65%
          );
        }

        .mc-dashboard .mc-total-projects-stat .mc-stat-value {
          color: #77e5e0;
        }

        /* Smaller desktops and tablets */
        @media (max-width: 1200px) {
          .mc-dashboard .mc-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        /* Mobile screens */
        @media (max-width: 760px) {
          .mc-dashboard .mc-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }
        }

        /* Very narrow phones */
        @media (max-width: 440px) {
          .mc-dashboard .mc-stats-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .mc-dashboard .mc-stat-card {
            min-height: 98px;
          }
        }
      `}</style>

      <section className="mc-stats-grid" aria-label="Workspace statistics">
        {/* TOTAL PROJECTS */}

        <button
          type="button"
          className="mc-stat-card mc-total-projects-stat"
          onClick={() => navigate("/projects")}
        >
          <div className="mc-stat-top">
            <span>Total Projects</span>
            <FolderKanban size={15} />
          </div>

          <div className="mc-stat-value">
            {loading ? "..." : projects.length}
          </div>

          <span className="mc-stat-caption">Projects in this workspace</span>
        </button>

        {/* PROJECT PROGRESS */}

        <button
          type="button"
          className="mc-stat-card mc-progress-stat"
          onClick={() => navigate("/projects")}
        >
          <div className="mc-stat-top">
            <span>Project Progress</span>
            <FolderKanban size={15} />
          </div>

          <div className="mc-progress-stat-content">
            <div className="mc-stat-value">
              {loading
                ? "..."
                : projectProgress === null
                  ? "—"
                  : `${projectProgress}%`}
            </div>

            <div
              className="mc-progress-ring"
              style={{
                "--progress-angle":
                  projectProgress === null
                    ? "0deg"
                    : `${projectProgress * 3.6}deg`,
              }}
              aria-label={
                projectProgress === null
                  ? "Project progress unavailable"
                  : `${projectProgress}% task completion`
              }
            >
              <span>
                {projectProgress === null ? "—" : `${projectProgress}%`}
              </span>
            </div>
          </div>

          <span className="mc-stat-caption">
            Completion across workspace tasks
          </span>
        </button>

        {/* ACTIVE TASKS */}

        <button
          type="button"
          className="mc-stat-card"
          onClick={() => navigate("/tasks")}
        >
          <div className="mc-stat-top">
            <span>Active Tasks</span>
            <CheckSquare size={15} />
          </div>

          <div className="mc-stat-value">
            {loading ? "..." : activeTaskCount}
          </div>

          <span className="mc-stat-caption">Tasks currently in progress</span>
        </button>

        {/* BLOCKED TASKS */}

        <button
          type="button"
          className="mc-stat-card mc-blocked-stat"
          onClick={() => navigate("/tasks")}
        >
          <div className="mc-stat-top">
            <span>Blocked Tasks</span>
            <AlertCircle size={15} />
          </div>

          <div className="mc-stat-value">
            {loading ? "..." : blockedTasks.length}
          </div>

          <span className="mc-stat-caption">Tasks marked as blocked</span>
        </button>

        {/* TEAM MEMBERS */}

        <button
          type="button"
          className="mc-stat-card"
          onClick={() => navigate("/teams")}
        >
          <div className="mc-stat-top">
            <span>Team Members</span>
            <Users size={15} />
          </div>

          <div className="mc-stat-value">
            {loading ? "..." : teamMemberCount}
          </div>

          <span className="mc-stat-caption">
            Members across workspace teams
          </span>
        </button>
      </section>

      {/* INVITATION OVERVIEW — ONE CLICKABLE CARD WITH A TWO-COLUMN COMPARISON */}

      {canInviteIndividualMembers && (
        <>
          <style>{`
            .mc-invitation-overview {
              margin: 7px 0 23px;
            }

            .mc-invitation-overview-card {
              display: block;
              width: 100%;
              padding: 20px 22px;
              color: #eaf3ff;
              text-align: left;
              background: linear-gradient(
                135deg,
                rgba(18, 32, 49, 0.97),
                rgba(12, 21, 35, 0.98)
              );
              border: 1px solid rgba(112, 167, 192, 0.2);
              border-radius: 17px;
              cursor: pointer;
              transition:
                border-color 180ms ease,
                background 180ms ease,
                transform 180ms ease;
            }

            .mc-invitation-overview-card:hover {
              border-color: rgba(100, 216, 223, 0.52);
              background: linear-gradient(
                135deg,
                rgba(21, 40, 57, 0.99),
                rgba(13, 25, 41, 0.99)
              );
              transform: translateY(-2px);
            }

            .mc-invitation-overview-card:focus-visible {
              outline: 2px solid #65dcd8;
              outline-offset: 3px;
            }

            .mc-invitation-card-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 18px;
              margin-bottom: 19px;
            }

            .mc-invitation-card-title {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              min-width: 0;
            }

            .mc-invitation-card-icon {
              display: grid;
              place-items: center;
              width: 41px;
              height: 41px;
              flex: 0 0 auto;
              color: #7de4ee;
              background: rgba(100, 216, 223, 0.08);
              border: 1px solid rgba(100, 216, 223, 0.18);
              border-radius: 12px;
            }

            .mc-invitation-card-title h2 {
              margin: 1px 0 6px;
              color: #f0f6ff;
              font-size: 16px;
              font-weight: 750;
              letter-spacing: -0.25px;
            }

            .mc-invitation-card-title p {
              margin: 0;
              color: #8fa5bb;
              font-size: 11px;
              line-height: 1.7;
            }

            .mc-invitation-view-label {
              display: inline-flex;
              align-items: center;
              gap: 7px;
              flex: 0 0 auto;
              padding-top: 5px;
              color: #85e1e8;
              font-size: 11px;
              font-weight: 700;
            }

            .mc-invitation-preview-table {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
              overflow: hidden;
              border: 1px solid rgba(126, 163, 190, 0.16);
              border-radius: 12px;
              background: rgba(5, 12, 23, 0.35);
            }

            .mc-invitation-preview-column {
              min-width: 0;
              padding: 17px 19px 16px;
            }

            .mc-invitation-preview-column + .mc-invitation-preview-column {
              border-left: 1px solid rgba(126, 163, 190, 0.18);
            }

            .mc-invitation-preview-label {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
              color: #afc1d5;
              font-size: 11px;
              font-weight: 700;
            }

            .mc-invitation-preview-label.pending svg {
              color: #f4c276;
            }

            .mc-invitation-preview-label.accepted svg {
              color: #6fe0b4;
            }

            .mc-invitation-preview-count {
              margin-bottom: 5px;
              color: #f2f7ff;
              font-size: clamp(25px, 3vw, 32px);
              line-height: 1.1;
              font-weight: 780;
              letter-spacing: -1px;
            }

            .mc-invitation-preview-caption {
              color: #8299b0;
              font-size: 10px;
              line-height: 1.6;
            }

            .mc-invitation-error {
              margin: 10px 2px 0;
              color: #ffc4cb;
              font-size: 11px;
              line-height: 1.6;
            }

            @media (max-width: 560px) {
              .mc-invitation-overview-card {
                padding: 16px;
              }

              .mc-invitation-card-header {
                gap: 9px;
              }

              .mc-invitation-view-label {
                max-width: 94px;
                text-align: right;
                white-space: normal;
              }

              .mc-invitation-preview-column {
                padding: 14px 12px;
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .mc-invitation-overview-card {
                transition: none;
              }
            }
          `}</style>

          <section
            className="mc-invitation-overview"
            aria-labelledby="mc-invitation-overview-title"
          >
            <div
              className="mc-invitation-overview-card"
              role="button"
              tabIndex={0}
              aria-label={`Open invitation details. ${invitationCounts.pending} pending invitations and ${invitationCounts.accepted} accepted invitations.`}
              onClick={() => setShowInvitationDetailsPage(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setShowInvitationDetailsPage(true);
                }
              }}
            >
              <div className="mc-invitation-card-header">
                <div className="mc-invitation-card-title">
                  <span className="mc-invitation-card-icon">
                    <Mail size={19} />
                  </span>

                  <div>
                    <span className="mc-eyebrow">ACCESS CONTROL</span>

                    <h2 id="mc-invitation-overview-title">
                      Invitation Overview
                    </h2>

                    <p>
                      Compare members who are still pending with members who
                      have accepted.
                    </p>
                  </div>
                </div>

                <span className="mc-invitation-view-label">
                  View details <ArrowRight size={15} />
                </span>
              </div>

              <div className="mc-invitation-preview-table" aria-live="polite">
                <div className="mc-invitation-preview-column">
                  <div className="mc-invitation-preview-label pending">
                    <Clock3 size={15} />
                    Pending Invitations
                  </div>

                  <div className="mc-invitation-preview-count">
                    {invitationCountsLoading ? "..." : invitationCounts.pending}
                  </div>

                  <div className="mc-invitation-preview-caption">
                    Awaiting acceptance
                  </div>
                </div>

                <div className="mc-invitation-preview-column">
                  <div className="mc-invitation-preview-label accepted">
                    <CheckCircle2 size={15} />
                    Accepted Invitations
                  </div>

                  <div className="mc-invitation-preview-count">
                    {invitationCountsLoading
                      ? "..."
                      : invitationCounts.accepted}
                  </div>

                  <div className="mc-invitation-preview-caption">
                    Accepted successfully
                  </div>
                </div>
              </div>
            </div>

            {invitationCountsError && (
              <p className="mc-invitation-error" role="alert">
                {invitationCountsError}
              </p>
            )}
          </section>
        </>
      )}

      {/* MAIN CONTENT */}

      <section className="mc-dashboard-layout">
        {/* TASK BOARD */}

        <section className="mc-board-panel">
          <div className="mc-section-heading">
            <div>
              <span className="mc-eyebrow">WORK MANAGEMENT</span>

              <h2>Team Task Board</h2>

              <p>Track work as it moves through your workflow.</p>
            </div>

            <button
              type="button"
              className="mc-text-action"
              onClick={() => navigate("/tasks")}
            >
              View All Tasks
              <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="mc-empty-state">
              <CheckSquare size={27} />
              <h3>Loading task board...</h3>
              <p>Preparing your workspace tasks.</p>
            </div>
          ) : (
            <div className="mc-task-board">
              {/* TO DO */}

              <section className="mc-board-column">
                <div className="mc-column-heading">
                  <div className="mc-column-title">
                    <span className="mc-status-dot mc-dot-todo" />
                    <h3>To Do</h3>
                  </div>

                  <span className="mc-column-count">{toDoTasks.length}</span>
                </div>

                <div className="mc-column-tasks">
                  {toDoTasks.length === 0 ? (
                    <div className="mc-column-empty">No tasks to do</div>
                  ) : (
                    toDoTasks.slice(0, 5).map((task) => (
                      <button
                        type="button"
                        key={getTaskId(task)}
                        className="mc-task-card"
                        onClick={() => openTask(task)}
                      >
                        <div className="mc-task-card-heading">
                          <strong>{getTaskTitle(task)}</strong>
                          <ArrowRight size={14} />
                        </div>

                        {getTaskDescription(task) && (
                          <p className="mc-task-description">
                            {getTaskDescription(task)}
                          </p>
                        )}

                        <div className="mc-task-card-footer">
                          <span className="mc-task-status mc-status-todo">
                            To Do
                          </span>

                          <span className="mc-task-date">
                            <Clock3 size={12} />
                            {getDueLabel(task)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* IN PROGRESS */}

              <section className="mc-board-column">
                <div className="mc-column-heading">
                  <div className="mc-column-title">
                    <span className="mc-status-dot mc-dot-progress" />
                    <h3>In Progress</h3>
                  </div>

                  <span className="mc-column-count">
                    {inProgressTasks.length}
                  </span>
                </div>

                <div className="mc-column-tasks">
                  {inProgressTasks.length === 0 ? (
                    <div className="mc-column-empty">No active tasks</div>
                  ) : (
                    inProgressTasks.slice(0, 5).map((task) => (
                      <button
                        type="button"
                        key={getTaskId(task)}
                        className="mc-task-card"
                        onClick={() => openTask(task)}
                      >
                        <div className="mc-task-card-heading">
                          <strong>{getTaskTitle(task)}</strong>
                          <ArrowRight size={14} />
                        </div>

                        {getTaskDescription(task) && (
                          <p className="mc-task-description">
                            {getTaskDescription(task)}
                          </p>
                        )}

                        <div className="mc-task-card-footer">
                          <span className="mc-task-status mc-status-progress">
                            In Progress
                          </span>

                          <span className="mc-task-date">
                            <Clock3 size={12} />
                            {getDueLabel(task)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>

              {/* COMPLETED */}

              <section className="mc-board-column">
                <div className="mc-column-heading">
                  <div className="mc-column-title">
                    <span className="mc-status-dot mc-dot-completed" />
                    <h3>Completed</h3>
                  </div>

                  <span className="mc-column-count">
                    {completedTasks.length}
                  </span>
                </div>

                <div className="mc-column-tasks">
                  {completedTasks.length === 0 ? (
                    <div className="mc-column-empty">
                      No completed tasks yet
                    </div>
                  ) : (
                    completedTasks.slice(0, 5).map((task) => (
                      <button
                        type="button"
                        key={getTaskId(task)}
                        className="mc-task-card"
                        onClick={() => openTask(task)}
                      >
                        <div className="mc-task-card-heading">
                          <strong>{getTaskTitle(task)}</strong>
                          <ArrowRight size={14} />
                        </div>

                        <div className="mc-task-card-footer">
                          <span className="mc-task-status mc-status-completed">
                            Completed
                          </span>

                          <span className="mc-task-date">
                            <CheckSquare size={12} />
                            Done
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}

          <div className="mc-board-footer">
            <span>
              {loading
                ? "Loading tasks..."
                : `${tasks.length} total workspace tasks`}
            </span>

            <button
              type="button"
              className="mc-text-action"
              onClick={handleCreateTask}
            >
              <Plus size={15} />
              New Task
            </button>
          </div>
        </section>

        {/* RIGHT RAIL */}

        <aside className="mc-right-rail">
          {/* UPCOMING DEADLINES */}

          <section className="mc-side-panel">
            <div className="mc-panel-heading">
              <div>
                <span className="mc-eyebrow">STAY ON TRACK</span>
                <h2>Upcoming Deadlines</h2>
              </div>

              <CalendarDays size={17} />
            </div>

            {loading ? (
              <div className="mc-small-state">Loading deadlines...</div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="mc-small-state">
                <CalendarDays size={23} />
                <span>No upcoming deadlines found.</span>
              </div>
            ) : (
              <div className="mc-deadline-list">
                {upcomingDeadlines.map((task) => (
                  <button
                    type="button"
                    key={getTaskId(task)}
                    className="mc-deadline-item"
                    onClick={() => openTask(task)}
                  >
                    <span className="mc-deadline-marker" />

                    <span className="mc-deadline-content">
                      <strong>{getTaskTitle(task)}</strong>
                      <span>{getDueLabel(task)}</span>
                    </span>

                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="mc-panel-footer-link"
              onClick={() => navigate("/tasks")}
            >
              View Tasks
              <ArrowRight size={14} />
            </button>
          </section>

          {/* ACTION REQUIRED */}

          <section className="mc-side-panel mc-action-panel">
            <div className="mc-panel-heading">
              <div>
                <span className="mc-eyebrow">NEEDS ATTENTION</span>
                <h2>Action Required</h2>
              </div>

              <AlertCircle size={18} />
            </div>

            {loading ? (
              <div className="mc-small-state">Checking task status...</div>
            ) : actionRequired.length === 0 ? (
              <div className="mc-no-actions">
                <CheckSquare size={24} />
                <strong>You're all caught up.</strong>
                <span>No blocked or overdue tasks were found.</span>
              </div>
            ) : (
              <div className="mc-action-list">
                {actionRequired.map((task) => {
                  const blocked = getTaskColumn(task) === "blocked";

                  return (
                    <button
                      type="button"
                      key={getTaskId(task)}
                      className={`mc-action-card ${
                        blocked ? "mc-action-blocked" : "mc-action-overdue"
                      }`}
                      onClick={() => openTask(task)}
                    >
                      <div className="mc-action-card-top">
                        <AlertCircle size={14} />
                        <span>{blocked ? "Blocked" : "Overdue"}</span>
                        <ArrowRight size={13} />
                      </div>

                      <strong>{getTaskTitle(task)}</strong>

                      <span className="mc-action-description">
                        {blocked
                          ? "This task is marked as blocked."
                          : getDueLabel(task)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="mc-panel-footer-link"
              onClick={() => navigate("/tasks")}
            >
              Review Tasks
              <ArrowRight size={14} />
            </button>
          </section>
        </aside>
      </section>

      {/* TEAM MEMBERS */}

      <section className="mc-team-panel">
        <div className="mc-section-heading">
          <div>
            <span className="mc-eyebrow">COLLABORATION</span>
            <h2>Team Members</h2>
            <p>People connected to your workspace teams.</p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {canInviteIndividualMembers && (
              <button
                type="button"
                className="mc-primary-action"
                onClick={handleOpenInviteMemberPage}
                disabled={loading}
              >
                <UserPlus size={16} />
                Invite Member
              </button>
            )}

            <button
              type="button"
              className="mc-text-action"
              onClick={() => navigate("/teams")}
            >
              View Teams
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mc-small-state">Loading team members...</div>
        ) : teamMembers.length === 0 ? (
          <div className="mc-empty-state">
            <Users size={27} />

            <h3>No team members found</h3>

            <p>
              Team members will appear here when they are connected to your
              workspace teams.
            </p>

            {canInviteIndividualMembers && (
              <button
                type="button"
                className="mc-primary-action"
                onClick={handleOpenInviteMemberPage}
              >
                <UserPlus size={16} />
                Invite Your First Member
              </button>
            )}
          </div>
        ) : (
          <div className="mc-team-roster">
            {teamMembers.slice(0, 6).map((member, index) => (
              <button
                type="button"
                key={`${member.id ?? member.user_id ?? "member"}-${member.teamId ?? index}`}
                className="mc-team-member-card"
                onClick={() => handleMemberClick(member)}
              >
                <span className="mc-member-avatar">
                  {getMemberInitials(member)}
                </span>

                <span className="mc-member-copy">
                  <strong>{getMemberName(member)}</strong>
                  <span>{member.teamName || "Workspace Member"}</span>
                </span>

                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* MEMBER DETAILS MODAL */}

      {selectedMember && (
        <div className="member-details-overlay" onClick={closeMemberDetails}>
          <section
            className="member-details-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mc-member-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="member-details-header">
              <div>
                <span className="mc-eyebrow">TEAM MEMBER</span>

                <h3 id="mc-member-dialog-title">
                  {getMemberName(selectedMember)}
                </h3>
              </div>

              <button
                type="button"
                className="member-details-close"
                onClick={closeMemberDetails}
                aria-label="Close member details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="member-details-profile">
              <div className="member-details-avatar">
                {getMemberInitials(selectedMember)}
              </div>

              <div>
                <strong>{getMemberName(selectedMember)}</strong>
                <span>{selectedMember.email || "Workspace Member"}</span>
              </div>
            </div>

            <div className="member-details-info">
              <div>
                <span>Team</span>
                <strong>{selectedMember.teamName || "ZYRA Workspace"}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong>Active</strong>
              </div>
            </div>

            {!showMessagePanel ? (
              <div className="member-details-actions">
                <button
                  type="button"
                  className="member-message-btn"
                  onClick={() => setShowMessagePanel(true)}
                >
                  <MessageSquare size={16} />
                  Message Team Member
                </button>

                <button
                  type="button"
                  className="member-view-team-btn"
                  onClick={() => navigate("/teams")}
                >
                  View Team
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="member-message-structure">
                <div className="message-structure-icon">
                  <MessageSquare size={20} />
                </div>

                <strong>Messaging is ready for integration.</strong>

                <p>
                  The dashboard interaction is prepared. Actual messaging will
                  be connected when a messaging backend is available.
                </p>

                <button
                  type="button"
                  className="member-view-team-btn"
                  onClick={() => setShowMessagePanel(false)}
                >
                  Back to member details
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default Dashboard;
