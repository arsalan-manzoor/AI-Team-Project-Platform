import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderKanban,
  Layers,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UserRound,
  UserPlus,
  X,
} from "lucide-react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";
import { apiRequest } from "../services/api";

import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/HRDash.css";

/* ============================================================
   CONSTANTS
============================================================ */

const COMPLETED_STATUSES = new Set(["completed", "complete", "done"]);

const ACTIVE_STATUSES = new Set([
  "in_progress",
  "in progress",
  "active",
  "working",
  "doing",
]);

const PEOPLE_ACTIVITY_KEYWORDS = [
  "employee",
  "invitation",
  "invited",
  "invite",
  "member",
  "profile",
  "role",
  "onboarding",
  "account",
  "team",
  "joined",
];

/* ============================================================
   DATA HELPERS
============================================================ */

function getArray(value, key) {
  if (Array.isArray(value)) {
    return value;
  }

  if (key && Array.isArray(value?.[key])) {
    return value[key];
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.members)) {
    return value.members;
  }

  if (Array.isArray(value?.projects)) {
    return value.projects;
  }

  if (Array.isArray(value?.teams)) {
    return value.teams;
  }

  if (Array.isArray(value?.tasks)) {
    return value.tasks;
  }

  if (Array.isArray(value?.notifications)) {
    return value.notifications;
  }

  return [];
}

function getId(item) {
  return item?.id ?? item?.project_id ?? item?.team_id ?? item?.task_id;
}

function normalizeStatus(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isCompleted(task) {
  return COMPLETED_STATUSES.has(normalizeStatus(task?.status));
}

function isActiveTask(task) {
  return ACTIVE_STATUSES.has(normalizeStatus(task?.status));
}

function getMemberRole(member) {
  return String(member?.workspace_role || member?.role || "USER")
    .trim()
    .toUpperCase();
}

function getRoleLabel(role) {
  const labels = {
    ADMIN: "Administrator",
    HR: "Human Resources",
    TEAM_LEADER: "Team Leader",
    USER: "Member",
  };

  return labels[role] || role.replace(/_/g, " ");
}

function getMemberName(member) {
  return (
    member?.name ||
    member?.user_name ||
    member?.username ||
    member?.email ||
    "Workspace Member"
  );
}

function getInitials(value) {
  return String(value || "ZYRA")
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAccountStatus(member) {
  return normalizeStatus(member?.account_status || "unknown");
}

function formatAccountStatus(value) {
  if (!value || value === "unknown") {
    return "Unknown";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRelativeTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const difference = Math.max(0, Date.now() - date.getTime());

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function getNotificationText(notification) {
  return [
    notification?.title,
    notification?.message,
    notification?.type,
    notification?.event_type,
  ]
    .filter(Boolean)
    .join(" ");
}

function isPeopleNotification(notification) {
  const content = getNotificationText(notification).toLowerCase();

  return PEOPLE_ACTIVITY_KEYWORDS.some((keyword) => content.includes(keyword));
}

/* ============================================================
   HR DASHBOARD
============================================================ */

function HRDash() {
  const navigate = useNavigate();

  const {
    activeWorkspace,
    workspaceId,
    workspaceName,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  /* ==========================================================
     STATE
  ========================================================== */

  const [user, setUser] = useState(null);

  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [memberTeamMap, setMemberTeamMap] = useState({});

  const [teamLeaderAssignments, setTeamLeaderAssignments] = useState([]);

  const [teamLeaderAssignmentsError, setTeamLeaderAssignmentsError] =
    useState("");

  /* ==========================================================
     ADD MEMBER TO HR WORKSPACE STATE
  ========================================================== */

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const [availableTeamLeaders, setAvailableTeamLeaders] = useState([]);

  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState("");

  const [loadingAvailableTeamLeaders, setLoadingAvailableTeamLeaders] =
    useState(false);

  const [addingTeamLeader, setAddingTeamLeader] = useState(false);

  const [addMemberError, setAddMemberError] = useState("");

  const [addMemberSuccess, setAddMemberSuccess] = useState("");

  const [showCreateTeamLeaderForm, setShowCreateTeamLeaderForm] =
    useState(false);
  const [teamLeaderForm, setTeamLeaderForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [creatingTeamLeader, setCreatingTeamLeader] = useState(false);
  const [createdTeamLeader, setCreatedTeamLeader] = useState(null);
  const [retryingTeamLeaderInvitation, setRetryingTeamLeaderInvitation] =
    useState(false);

  /* ==========================================================
     CREATE TASK PROJECT SELECTOR
  ========================================================== */

  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);

  const [selectedTaskProjectId, setSelectedTaskProjectId] = useState("");

  const [createTaskModalError, setCreateTaskModalError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  /* ==========================================================
     WORKSPACE PERMISSIONS
  ========================================================== */

  const normalizedWorkspaceRole = String(
    workspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  const normalizedWorkspaceType = String(
    activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      activeWorkspace?.workspaceType ||
      "",
  )
    .trim()
    .toUpperCase();

  const canAddMemberToWorkspace =
    normalizedWorkspaceType === "COMPANY" && normalizedWorkspaceRole === "HR";

  const canCreateCompanyContent = normalizedWorkspaceRole === "HR";

  /* ==========================================================
     LOAD DASHBOARD DATA
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (workspaceLoading) {
        return;
      }

      if (!workspaceId) {
        setUser(null);
        setMembers([]);
        setTeams([]);
        setProjects([]);
        setTasks([]);
        setNotifications([]);
        setMemberTeamMap({});

        setTeamLeaderAssignments([]);
        setTeamLeaderAssignmentsError("");

        setError("No active workspace was found for this account.");

        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const results = await Promise.allSettled([
        getCurrentUser(),
        getProjects(),
        getTeams(),
        getTasks(),

        apiRequest(`/workspaces/company/${workspaceId}/organization-members`),

        apiRequest(
          `/workspaces/company/${workspaceId}/hr-team-leader-assignments`,
        ),

        apiRequest("/notifications"),
      ]);

      if (cancelled) {
        return;
      }

      const [
        userResult,
        projectsResult,
        teamsResult,
        tasksResult,
        organizationMembersResult,
        reportingAssignmentsResult,
        notificationsResult,
      ] = results;

      const reportingAssignments =
        reportingAssignmentsResult.status === "fulfilled" &&
        Array.isArray(reportingAssignmentsResult.value?.assignments)
          ? reportingAssignmentsResult.value.assignments
          : [];

      const reportingAssignmentsError =
        reportingAssignmentsResult.status === "rejected"
          ? "Reporting assignments could not be loaded. Please refresh the dashboard."
          : "";

      const currentUser =
        userResult.status === "fulfilled" ? userResult.value : null;

      const allProjects =
        projectsResult.status === "fulfilled"
          ? getArray(projectsResult.value, "projects")
          : [];

      const allTeams =
        teamsResult.status === "fulfilled"
          ? getArray(teamsResult.value, "teams")
          : [];

      const allTasks =
        tasksResult.status === "fulfilled"
          ? getArray(tasksResult.value, "tasks")
          : [];

      let organizationMembers = [];
      let membersError = false;

      if (organizationMembersResult.status === "fulfilled") {
        organizationMembers = getArray(
          organizationMembersResult.value,
          "members",
        );
      } else {
        try {
          const workspaceMembersResult = await apiRequest(
            `/workspaces/${workspaceId}/members`,
          );

          if (cancelled) {
            return;
          }

          organizationMembers = getArray(workspaceMembersResult, "members");

          membersError = true;
        } catch {
          organizationMembers = [];
          membersError = true;
        }
      }

      const allNotifications =
        notificationsResult.status === "fulfilled"
          ? getArray(notificationsResult.value, "notifications")
          : [];

      const workspaceTeams = allTeams.filter(
        (team) =>
          team.workspace_id !== undefined &&
          team.workspace_id !== null &&
          Number(team.workspace_id) === Number(workspaceId),
      );

      const workspaceTeamIds = new Set(
        workspaceTeams.map((team) => Number(getId(team))),
      );

      const workspaceProjects = allProjects.filter((project) => {
        if (
          project.workspace_id !== undefined &&
          project.workspace_id !== null
        ) {
          return Number(project.workspace_id) === Number(workspaceId);
        }

        return (
          project.team_id !== undefined &&
          workspaceTeamIds.has(Number(project.team_id))
        );
      });

      const workspaceProjectIds = new Set(
        workspaceProjects.map((project) => Number(getId(project))),
      );

      const workspaceTasks = allTasks.filter((task) =>
        workspaceProjectIds.has(Number(task.project_id)),
      );

      const teamMembershipResults = await Promise.allSettled(
        workspaceTeams.map((team) => getTeamMembers(getId(team))),
      );

      if (cancelled) {
        return;
      }

      const nextMemberTeamMap = {};

      teamMembershipResults.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const team = workspaceTeams[index];

        const teamMembers = getArray(result.value, "members");

        teamMembers.forEach((teamMember) => {
          const memberId =
            teamMember?.user_id ?? teamMember?.userId ?? teamMember?.member_id;

          if (memberId === undefined || memberId === null) {
            return;
          }

          const key = String(memberId);

          if (!nextMemberTeamMap[key]) {
            nextMemberTeamMap[key] = [];
          }

          if (
            !nextMemberTeamMap[key].some(
              (item) => Number(item.id) === Number(getId(team)),
            )
          ) {
            nextMemberTeamMap[key].push({
              id: getId(team),
              name: team.name || "Unnamed team",
            });
          }
        });
      });

      const sortedNotifications = [...allNotifications].sort(
        (first, second) => {
          const firstDate = new Date(
            first.created_at || first.createdAt || 0,
          ).getTime();

          const secondDate = new Date(
            second.created_at || second.createdAt || 0,
          ).getTime();

          return secondDate - firstDate;
        },
      );

      setUser(currentUser);
      setMembers(organizationMembers);
      setTeams(workspaceTeams);
      setProjects(workspaceProjects);
      setTasks(workspaceTasks);
      setNotifications(sortedNotifications);
      setMemberTeamMap(nextMemberTeamMap);

      setTeamLeaderAssignments(reportingAssignments);
      setTeamLeaderAssignmentsError(reportingAssignmentsError);

      const importantRequestFailed =
        userResult.status === "rejected" ||
        projectsResult.status === "rejected" ||
        teamsResult.status === "rejected" ||
        tasksResult.status === "rejected" ||
        notificationsResult.status === "rejected";

      if (importantRequestFailed || membersError) {
        setError(
          "Some people or workspace information could not be loaded. Refresh the dashboard to try again.",
        );
      }

      setLoading(false);
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, workspaceLoading, refreshKey]);

  /* ==========================================================
     HR-OWNED PROJECTS
  ========================================================== */

  const hrCreatedProjects = useMemo(() => {
    const currentUserId = user?.id ?? user?.user_id ?? user?.userId;

    if (currentUserId === null || currentUserId === undefined) {
      return [];
    }

    return projects
      .filter((project) => {
        const creatorId =
          project?.created_by ??
          project?.createdBy ??
          project?.created_by_user_id ??
          project?.creator_id;

        return (
          creatorId !== null &&
          creatorId !== undefined &&
          Number(creatorId) === Number(currentUserId)
        );
      })
      .sort((first, second) =>
        String(first?.name || "").localeCompare(String(second?.name || "")),
      );
  }, [projects, user]);

  /* ==========================================================
     ADD MEMBER TO YOUR WORKSPACE
  ========================================================== */

  async function handleOpenAddMemberModal() {
    if (!canAddMemberToWorkspace || !workspaceId) {
      return;
    }

    setShowAddMemberModal(true);

    setAvailableTeamLeaders([]);
    setSelectedTeamLeaderId("");

    setAddMemberError("");
    setAddMemberSuccess("");
    setShowCreateTeamLeaderForm(false);
    setTeamLeaderForm({ name: "", email: "", password: "" });
    setCreatedTeamLeader(null);

    try {
      setLoadingAvailableTeamLeaders(true);

      const response = await apiRequest(
        `/workspaces/company/${workspaceId}/available-team-leaders`,
      );

      const available = getArray(response, "team_leaders").filter(
        (member) =>
          getMemberRole(member) === "TEAM_LEADER" &&
          getAccountStatus(member) === "active" &&
          Number(member.user_id) > 0,
      );

      setAvailableTeamLeaders(available);

      if (available.length > 0) {
        setSelectedTeamLeaderId(String(available[0].user_id));
      }
    } catch (loadError) {
      console.error("Available Team Leader loading error:", loadError);

      setAddMemberError(
        loadError.message || "Unable to load available Team Leaders.",
      );
    } finally {
      setLoadingAvailableTeamLeaders(false);
    }
  }

  function handleCloseAddMemberModal() {
    if (
      addingTeamLeader ||
      creatingTeamLeader ||
      retryingTeamLeaderInvitation
    ) {
      return;
    }

    setShowAddMemberModal(false);
    setAvailableTeamLeaders([]);
    setSelectedTeamLeaderId("");
    setAddMemberError("");
    setShowCreateTeamLeaderForm(false);
    setTeamLeaderForm({ name: "", email: "", password: "" });
    setCreatedTeamLeader(null);
  }

  function updateTeamLeaderForm(field, value) {
    setTeamLeaderForm((current) => ({ ...current, [field]: value }));
    setAddMemberError("");
  }

  async function refreshAvailableTeamLeaders() {
    try {
      const response = await apiRequest(
        `/workspaces/company/${workspaceId}/available-team-leaders`,
      );

      const available = getArray(response, "team_leaders").filter(
        (member) =>
          getMemberRole(member) === "TEAM_LEADER" &&
          getAccountStatus(member) === "active" &&
          Number(member.user_id) > 0,
      );

      setAvailableTeamLeaders(available);
      setSelectedTeamLeaderId(
        available.length > 0 ? String(available[0].user_id) : "",
      );
    } catch (refreshError) {
      console.error("Available Team Leader refresh error:", refreshError);
      setAddMemberError(
        "The invitation was sent, but the available Team Leader list could not refresh. Close and reopen this window to reload it.",
      );
    }
  }

  async function sendCreatedTeamLeaderInvitation(teamLeader) {
    return apiRequest(`/workspaces/company/${workspaceId}/invitations`, {
      method: "POST",
      body: JSON.stringify({
        email: String(teamLeader.email).trim().toLowerCase(),
        role: "TEAM_LEADER",
        temporaryPassword: teamLeader.password,
      }),
    });
  }

  async function handleCreateTeamLeader(event) {
    event.preventDefault();

    if (!canAddMemberToWorkspace || !workspaceId) {
      setAddMemberError(
        "You do not have permission to create a Team Leader in this workspace.",
      );
      return;
    }

    const name = teamLeaderForm.name.trim();
    const email = teamLeaderForm.email.trim().toLowerCase();
    const password = teamLeaderForm.password;

    if (!name || !email || !password) {
      setAddMemberError("Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      setAddMemberError("Temporary password must be at least 6 characters.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setAddMemberError("Temporary password cannot exceed 72 bytes.");
      return;
    }

    let accountDetails = null;

    try {
      setCreatingTeamLeader(true);
      setAddMemberError("");

      const result = await apiRequest("/users/company-account", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          role: "TEAM_LEADER",
          workspaceId,
        }),
      });

      accountDetails = {
        name: result?.account?.name || name,
        email: result?.account?.email || email,
        password: result?.credentials?.password || password,
      };

      // Preserve the created account so an invitation retry never creates
      // a duplicate account.
      setCreatedTeamLeader(accountDetails);

      try {
        await sendCreatedTeamLeaderInvitation(accountDetails);

        setShowCreateTeamLeaderForm(false);
        setTeamLeaderForm({ name: "", email: "", password: "" });
        setCreatedTeamLeader(null);
        setAddMemberError("");
        setAddMemberSuccess(
          `Team Leader account created and invitation sent to ${accountDetails.email}. They will become eligible for assignment after accepting the invitation.`,
        );

        await refreshAvailableTeamLeaders();
      } catch (invitationError) {
        console.error("Team Leader invitation error:", invitationError);
        setAddMemberError(
          `The Team Leader account was created, but the invitation could not be sent. Your account details are shown below. Retry the invitation without creating the account again. ${
            invitationError.message || ""
          }`.trim(),
        );
      }
    } catch (createError) {
      console.error("Create Team Leader error:", createError);
      setAddMemberError(
        createError.message || "Unable to create the Team Leader account.",
      );
    } finally {
      setCreatingTeamLeader(false);
    }
  }

  async function handleRetryTeamLeaderInvitation() {
    if (!createdTeamLeader || !workspaceId) {
      return;
    }

    try {
      setRetryingTeamLeaderInvitation(true);
      setAddMemberError("");

      await sendCreatedTeamLeaderInvitation(createdTeamLeader);

      const invitedEmail = createdTeamLeader.email;
      setCreatedTeamLeader(null);
      setShowCreateTeamLeaderForm(false);
      setTeamLeaderForm({ name: "", email: "", password: "" });
      setAddMemberSuccess(
        `Invitation successfully sent to ${invitedEmail}. They will become eligible for assignment after accepting the invitation.`,
      );

      await refreshAvailableTeamLeaders();
    } catch (invitationError) {
      console.error("Retry Team Leader invitation error:", invitationError);
      setAddMemberError(
        invitationError.message || "Invitation retry failed. Please try again.",
      );
    } finally {
      setRetryingTeamLeaderInvitation(false);
    }
  }

  async function handleAddMemberToWorkspace(event) {
    event.preventDefault();

    if (!canAddMemberToWorkspace || !workspaceId) {
      setAddMemberError(
        "You do not have permission to add members to this workspace.",
      );
      return;
    }

    const teamLeaderUserId = Number(selectedTeamLeaderId);

    if (!Number.isInteger(teamLeaderUserId) || teamLeaderUserId <= 0) {
      setAddMemberError("Please select a valid Team Leader.");
      return;
    }

    const selectedLeader = availableTeamLeaders.find(
      (leader) => Number(leader.user_id) === teamLeaderUserId,
    );

    if (!selectedLeader) {
      setAddMemberError("The selected Team Leader is unavailable.");
      return;
    }

    try {
      setAddingTeamLeader(true);
      setAddMemberError("");

      const response = await apiRequest(
        `/workspaces/company/${workspaceId}/my-team-leaders`,
        {
          method: "POST",
          body: JSON.stringify({
            teamLeaderUserId,
          }),
        },
      );

      const addedName =
        response?.assignment?.team_leader_name ||
        selectedLeader.name ||
        "Team Leader";

      setShowAddMemberModal(false);

      setAvailableTeamLeaders([]);
      setSelectedTeamLeaderId("");

      setAddMemberSuccess(
        `${addedName} has been added to your workspace successfully.`,
      );

      setRefreshKey((current) => current + 1);
    } catch (addError) {
      console.error("Add Team Leader error:", addError);

      setAddMemberError(
        addError.message || "Unable to add this Team Leader to your workspace.",
      );
    } finally {
      setAddingTeamLeader(false);
    }
  }

  /* ==========================================================
     CREATE PROJECT
  ========================================================== */

  function handleCreateProject() {
    if (!canCreateCompanyContent) {
      return;
    }

    navigate("/projects/create");
  }

  /* ==========================================================
     CREATE TASK PROJECT SELECTOR
  ========================================================== */

  function handleOpenCreateTaskModal() {
    if (!canCreateCompanyContent) {
      return;
    }

    setCreateTaskModalError("");

    setSelectedTaskProjectId(
      hrCreatedProjects.length === 1 ? String(getId(hrCreatedProjects[0])) : "",
    );

    setShowCreateTaskModal(true);
  }

  function handleCloseCreateTaskModal() {
    setShowCreateTaskModal(false);
    setSelectedTaskProjectId("");
    setCreateTaskModalError("");
  }

  function handleContinueToCreateTask(event) {
    event.preventDefault();

    if (!canCreateCompanyContent) {
      setCreateTaskModalError(
        "You do not have permission to create Company tasks.",
      );
      return;
    }

    const selectedProject = hrCreatedProjects.find(
      (project) => Number(getId(project)) === Number(selectedTaskProjectId),
    );

    if (!selectedProject) {
      setCreateTaskModalError(
        "Please select one of the projects originally created by you.",
      );
      return;
    }

    const projectId = Number(getId(selectedProject));

    if (!Number.isInteger(projectId) || projectId <= 0) {
      setCreateTaskModalError("The selected project ID is invalid.");
      return;
    }

    setShowCreateTaskModal(false);

    navigate(`/projects/${projectId}/tasks/create`);
  }

  /* ==========================================================
     METRICS
  ========================================================== */

  const activeMembers = useMemo(
    () => members.filter((member) => getAccountStatus(member) === "active"),
    [members],
  );

  const otherStatusMembers = useMemo(
    () => members.filter((member) => getAccountStatus(member) !== "active"),
    [members],
  );

  const activeTasks = useMemo(() => tasks.filter(isActiveTask), [tasks]);

  const completedTasks = useMemo(() => tasks.filter(isCompleted), [tasks]);

  const taskCompletion = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const teamAssignedMembers = useMemo(
    () =>
      members.filter((member) => {
        const memberId = member.user_id ?? member.userId;

        if (memberId === undefined || memberId === null) {
          return false;
        }

        return (memberTeamMap[String(memberId)] || []).length > 0;
      }),
    [members, memberTeamMap],
  );

  const membersWithoutTeam = Math.max(
    0,
    members.length - teamAssignedMembers.length,
  );

  const pendingInvitationsCount = null;

  /* ==========================================================
     ROLE DISTRIBUTION
  ========================================================== */

  const roleDistribution = useMemo(() => {
    const definitions = [
      {
        role: "ADMIN",
        label: "Administrators",
        color: "cyan",
      },
      {
        role: "HR",
        label: "Human Resources",
        color: "violet",
      },
      {
        role: "TEAM_LEADER",
        label: "Team Leaders",
        color: "blue",
      },
      {
        role: "USER",
        label: "Members",
        color: "mint",
      },
    ];

    return definitions.map((definition) => {
      const count = members.filter(
        (member) => getMemberRole(member) === definition.role,
      ).length;

      const percentage = members.length
        ? Math.round((count / members.length) * 100)
        : 0;

      return {
        ...definition,
        count,
        percentage,
      };
    });
  }, [members]);

  const roleDistributionMaximum = Math.max(
    1,
    ...roleDistribution.map((item) => item.count),
  );

  const activeAccountAngle = members.length
    ? (activeMembers.length / members.length) * 360
    : 0;

  /* ==========================================================
     EMPLOYEE SEARCH
  ========================================================== */

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const memberId = member.user_id ?? member.userId ?? member.id;

        const assignedTeams = memberTeamMap[String(memberId)] || [];

        const teamNames = assignedTeams.map((team) => team.name).join(" ");

        const searchableText = [
          getMemberName(member),
          member.email,
          getRoleLabel(getMemberRole(member)),
          member.workspace_role,
          member.role,
          member.account_status,
          teamNames,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      }),
    [members, memberTeamMap, normalizedQuery],
  );

  /* ==========================================================
     RECENT PEOPLE ACTIVITY
  ========================================================== */

  const recentPeopleActivity = useMemo(
    () => notifications.filter(isPeopleNotification).slice(0, 7),
    [notifications],
  );

  const unreadNotifications = notifications.filter(
    (notification) =>
      notification.is_read === false || notification.is_read === 0,
  ).length;

  /* ==========================================================
     DERIVED DISPLAY DATA
  ========================================================== */

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const greeting = (() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 17) {
      return "Good afternoon";
    }

    return "Good evening";
  })();

  /* ==========================================================
     INTERACTIONS
  ========================================================== */

  function refreshDashboard() {
    setRefreshKey((current) => current + 1);
  }

  function scrollToDirectory() {
    document.getElementById("hr-employee-directory")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function openMemberTeam(member) {
    navigate("/teams");
  }

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (workspaceLoading || loading) {
    return (
      <main className="hr-dashboard">
        <section className="hr-loading-state">
          <div className="hr-loading-orb">
            <Sparkles size={25} />
          </div>

          <span className="hr-eyebrow">ZYRA / PEOPLE INTELLIGENCE</span>

          <h1>Preparing your people workspace</h1>

          <p>
            Connecting employee records, teams, and organizational activity.
          </p>

          <div className="hr-loading-track">
            <span />
          </div>
        </section>
      </main>
    );
  }

  /* ==========================================================
     MAIN DASHBOARD
  ========================================================== */

  return (
    <main className="hr-dashboard">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <header className="hr-page-header">
        <div className="hr-header-copy">
          <div className="hr-header-eyebrow">
            <span className="hr-eyebrow">PEOPLE OPERATIONS</span>

            <span className="hr-eyebrow-divider" />

            <span className="hr-header-date">{currentDate}</span>
          </div>

          <h1>People Intelligence</h1>

          <p>
            {greeting}, {user?.name?.split(" ")[0] || "HR"}
          </p>
        </div>

        <div className="hr-header-actions">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleCreateProject}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                minHeight: "40px",
                padding: "0 15px",
                border: "1px solid rgba(45, 212, 191, 0.3)",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0891b2, #0d9488)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <FolderKanban size={16} />
              Create Project
            </button>

            <button
              type="button"
              onClick={handleOpenCreateTaskModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                minHeight: "40px",
                padding: "0 15px",
                border: "1px solid rgba(99, 102, 241, 0.35)",
                borderRadius: "10px",
                background: "rgba(99, 102, 241, 0.12)",
                color: "#c4b5fd",
                fontSize: "12px",
                fontWeight: 650,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <CheckCircle2 size={16} />
              Create Task
            </button>
          </div>
          <label className="hr-search-box">
            <Search size={16} />

            <input
              type="search"
              aria-label="Search personnel"
              placeholder="Search personnel..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            {searchQuery && (
              <button
                type="button"
                className="hr-search-clear"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </label>

          <button
            type="button"
            className="hr-header-icon-button"
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
            onClick={refreshDashboard}
          >
            <RefreshCw size={16} />
          </button>

          <button
            type="button"
            className="hr-header-icon-button hr-notification-button"
            title="Open notifications"
            aria-label="Open notifications"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={17} />

            {unreadNotifications > 0 && (
              <span className="hr-notification-dot" />
            )}
          </button>

          <button
            type="button"
            className="hr-profile-avatar"
            title="Open profile"
            aria-label="Open profile"
            onClick={() => navigate("/profile")}
          >
            {getInitials(user?.name || user?.email)}
          </button>
        </div>
      </header>

      {/* ======================================================
          WARNING / SUCCESS BANNERS
      ====================================================== */}

      {error && (
        <div className="hr-warning-banner" role="status">
          <Activity size={16} />

          <span>{error}</span>

          <button type="button" onClick={refreshDashboard}>
            Retry
          </button>
        </div>
      )}

      {addMemberSuccess && (
        <div
          className="hr-warning-banner"
          role="status"
          style={{
            borderColor: "rgba(52, 211, 153, 0.3)",
            color: "#6ee7b7",
          }}
        >
          <CheckCircle2 size={16} />

          <span>{addMemberSuccess}</span>

          <button type="button" onClick={() => setAddMemberSuccess("")}>
            Dismiss
          </button>
        </div>
      )}

      {/* ======================================================
          PEOPLE INTELLIGENCE BENTO GRID
      ====================================================== */}

      <section
        className="hr-bento-grid"
        aria-label="People operations dashboard"
      >
        {/* WELCOME PANEL */}

        <article className="hr-welcome-panel">
          <div className="hr-welcome-waves" />
          <div className="hr-welcome-glow" />
          <div className="hr-welcome-grid" />

          <div className="hr-welcome-content">
            <span className="hr-welcome-eyebrow">
              <Sparkles size={13} />
              PEOPLE INTELLIGENCE
            </span>

            <h2>
              Welcome back
              <br />
              <span>{user?.name?.split(" ")[0] || "HR"}.</span>
            </h2>

            <p>
              Let's manage your organization's people and employee workspace.
            </p>

            <div className="hr-welcome-workspace">
              <span className="hr-welcome-workspace-icon">
                <BriefcaseBusiness size={14} />
              </span>

              <span>
                {workspaceName || activeWorkspace?.name || "Company Workspace"}
              </span>
            </div>

            <button
              type="button"
              className="hr-welcome-button"
              onClick={scrollToDirectory}
            >
              Explore employees
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="hr-welcome-art" aria-hidden="true">
            <div className="hr-art-orbit hr-art-orbit-one" />
            <div className="hr-art-orbit hr-art-orbit-two" />
            <div className="hr-art-orbit hr-art-orbit-three" />

            <div className="hr-art-core">
              <Users size={30} />
            </div>

            <span className="hr-art-node hr-art-node-one">
              <UserRound size={14} />
            </span>

            <span className="hr-art-node hr-art-node-two">
              <ShieldCheck size={14} />
            </span>

            <span className="hr-art-node hr-art-node-three">
              <Activity size={14} />
            </span>
          </div>
        </article>

        {/* TOTAL EMPLOYEES */}

        <button
          type="button"
          className="hr-metric-card hr-metric-employees"
          onClick={scrollToDirectory}
        >
          <span className="hr-metric-topline">
            <span>Total Employees</span>

            <span className="hr-metric-icon">
              <Users size={17} />
            </span>
          </span>

          <strong className="hr-metric-value">
            {members.length.toLocaleString("en-IN")}
          </strong>

          <span className="hr-metric-caption">
            Organization directory
            <ArrowRight size={13} />
          </span>
        </button>

        {/* ACTIVE ACCOUNTS */}

        <button
          type="button"
          className="hr-metric-card hr-metric-active"
          onClick={scrollToDirectory}
        >
          <span className="hr-metric-topline">
            <span>Active Accounts</span>

            <span className="hr-metric-icon">
              <CheckCircle2 size={17} />
            </span>
          </span>

          <strong className="hr-metric-value">
            {activeMembers.length.toLocaleString("en-IN")}
          </strong>

          <span className="hr-metric-caption">Accounts marked active</span>
        </button>

        {/* PENDING INVITATIONS */}

        <article
          className="hr-metric-card hr-metric-invitations"
          title="A company-wide outgoing invitation listing is not exposed by the current API."
        >
          <span className="hr-metric-topline">
            <span>Pending Invitations</span>

            <span className="hr-metric-icon">
              <UserPlus size={17} />
            </span>
          </span>

          <strong className="hr-metric-value">
            {pendingInvitationsCount === null ? "—" : pendingInvitationsCount}
          </strong>

          <span className="hr-metric-caption">
            Invitation reporting not connected
          </span>
        </article>

        {/* TEAMS */}

        <button
          type="button"
          className="hr-metric-card hr-metric-teams"
          onClick={() => navigate("/teams")}
        >
          <span className="hr-metric-topline">
            <span>Teams</span>

            <span className="hr-metric-icon">
              <Layers size={17} />
            </span>
          </span>

          <strong className="hr-metric-value">
            {teams.length.toLocaleString("en-IN")}
          </strong>

          <span className="hr-metric-caption">
            Workspace teams
            <ArrowRight size={13} />
          </span>
        </button>

        {/* EMPLOYEE DISTRIBUTION */}

        <article className="hr-panel hr-distribution-panel">
          <div className="hr-panel-heading">
            <div>
              <span className="hr-panel-eyebrow">WORKFORCE OVERVIEW</span>

              <h2>Employee Distribution</h2>

              <p>Workspace roles and account activity.</p>
            </div>

            <span className="hr-panel-heading-icon">
              <Activity size={17} />
            </span>
          </div>

          <div className="hr-distribution-content">
            <div className="hr-role-chart">
              <div className="hr-chart-legend">
                <span>
                  <i className="hr-legend-dot hr-legend-cyan" />
                  Role
                </span>

                <span>
                  <i className="hr-legend-dot hr-legend-violet" />
                  Workforce
                </span>
              </div>

              <div className="hr-bar-chart">
                {roleDistribution.map((item) => {
                  const barHeight =
                    item.count === 0
                      ? 3
                      : Math.max(
                          8,
                          Math.round(
                            (item.count / roleDistributionMaximum) * 100,
                          ),
                        );

                  return (
                    <button
                      type="button"
                      className="hr-bar-column"
                      key={item.role}
                      title={`${item.label}: ${item.count}`}
                      onClick={scrollToDirectory}
                    >
                      <span className="hr-bar-value">{item.count}</span>

                      <span className="hr-bar-track">
                        <span
                          className={`hr-bar-fill hr-bar-${item.color}`}
                          style={{
                            height: `${barHeight}%`,
                          }}
                        />
                      </span>

                      <span className="hr-bar-label">
                        {item.role === "TEAM_LEADER"
                          ? "Leader"
                          : item.role === "ADMIN"
                            ? "Admin"
                            : item.role === "HR"
                              ? "HR"
                              : "Member"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="hr-chart-footnote">
                <Users size={12} />

                <span>{members.length} organization members</span>
              </div>
            </div>

            <div className="hr-account-chart">
              <div
                className="hr-account-donut"
                style={{
                  "--hr-active-angle": `${activeAccountAngle}deg`,
                }}
                role="img"
                aria-label={`${activeMembers.length} active accounts out of ${members.length} members`}
              >
                <div className="hr-account-donut-center">
                  <strong>
                    {members.length
                      ? Math.round(
                          (activeMembers.length / members.length) * 100,
                        )
                      : 0}
                    %
                  </strong>

                  <span>ACTIVE</span>
                </div>
              </div>

              <div className="hr-account-chart-label">Account Status</div>

              <div className="hr-account-legend">
                <span>
                  <i className="hr-legend-dot hr-legend-cyan" />
                  Active
                  <strong>{activeMembers.length}</strong>
                </span>

                <span>
                  <i className="hr-legend-dot hr-legend-violet" />
                  Other
                  <strong>{otherStatusMembers.length}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="hr-role-breakdown">
            {roleDistribution.map((item) => (
              <div className="hr-role-breakdown-row" key={item.role}>
                <span className={`hr-role-dot hr-role-dot-${item.color}`} />

                <span>{item.label}</span>

                <div className="hr-role-progress-track">
                  <span
                    className={`hr-role-progress-fill hr-role-fill-${item.color}`}
                    style={{
                      width: `${item.percentage}%`,
                    }}
                  />
                </div>

                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>

        {/* RECENT PEOPLE ACTIVITY */}

        <article className="hr-panel hr-activity-panel">
          <div className="hr-panel-heading">
            <div>
              <span className="hr-panel-eyebrow">LIVE WORKSPACE SIGNALS</span>

              <h2>Recent People Activity</h2>

              <p>Employee and workspace-related notifications.</p>
            </div>

            <button
              type="button"
              className="hr-panel-icon-button"
              aria-label="View all notifications"
              title="View all notifications"
              onClick={() => navigate("/notifications")}
            >
              <Bell size={16} />
            </button>
          </div>

          <div className="hr-activity-timeline">
            {recentPeopleActivity.length === 0 ? (
              <div className="hr-activity-empty">
                <span className="hr-activity-empty-icon">
                  <Activity size={20} />
                </span>

                <strong>No recent people activity</strong>

                <p>
                  Employee-related updates will appear here when matching
                  notifications are available.
                </p>
              </div>
            ) : (
              recentPeopleActivity.map((notification, index) => (
                <button
                  type="button"
                  className="hr-activity-item"
                  key={notification.id ?? `${notification.title}-${index}`}
                  onClick={() => navigate("/notifications")}
                >
                  <span
                    className={`hr-activity-timeline-dot hr-activity-dot-${(index % 4) + 1}`}
                  />

                  <span className="hr-activity-item-copy">
                    <strong>{notification.title || "People update"}</strong>

                    <small>
                      {notification.message ||
                        "A workspace notification was received."}
                    </small>

                    <span className="hr-activity-time">
                      <Clock3 size={11} />

                      {formatRelativeTime(
                        notification.created_at || notification.createdAt,
                      )}
                    </span>
                  </span>

                  <ChevronRight size={14} className="hr-activity-chevron" />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="hr-panel-bottom-link"
            onClick={() => navigate("/notifications")}
          >
            View all notifications
            <ArrowRight size={14} />
          </button>
        </article>

        {/* EMPLOYEE DIRECTORY */}

        <article
          className="hr-panel hr-directory-panel"
          id="hr-employee-directory"
        >
          <div className="hr-panel-heading">
            <div>
              <span className="hr-panel-eyebrow">PEOPLE & RECORDS</span>

              <h2>Employee Directory</h2>

              <p>Employee identity, role, assigned team, and status.</p>
            </div>

            <button
              type="button"
              className="hr-text-action"
              onClick={() => navigate("/teams")}
            >
              Teams
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="hr-directory-toolbar">
            <div className="hr-directory-summary">
              <span className="hr-directory-summary-mark">
                <Users size={15} />
              </span>

              <span>
                <strong>{filteredMembers.length}</strong>

                <small>
                  {normalizedQuery ? "matching employees" : "employees shown"}
                </small>
              </span>
            </div>

            <label className="hr-directory-search">
              <Search size={14} />

              <input
                type="search"
                aria-label="Search employee directory"
                placeholder="Filter employees..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear employee search"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          {/* ==================================================
              HR REPORTING STRUCTURE
          ================================================== */}

          <section
            className="hr-reporting-roster"
            aria-labelledby="hr-reporting-title"
          >
            <div className="hr-reporting-roster-heading">
              <div>
                <span className="hr-panel-eyebrow">REPORTING STRUCTURE</span>

                <h3 id="hr-reporting-title">Assigned Team Leaders</h3>

                <p>Team Leaders who report to you.</p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <span className="hr-reporting-count">
                  {teamLeaderAssignments.length}{" "}
                  {teamLeaderAssignments.length === 1 ? "Leader" : "Leaders"}
                </span>

                {canAddMemberToWorkspace && (
                  <button
                    type="button"
                    className="hr-text-action"
                    onClick={handleOpenAddMemberModal}
                    disabled={loading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      padding: "9px 13px",
                      border: "1px solid rgba(45, 212, 191, 0.25)",
                      borderRadius: "9px",
                      background: "rgba(45, 212, 191, 0.07)",
                      color: "#7ce6d8",
                      fontSize: "12px",
                      fontWeight: 650,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <UserPlus size={15} />
                    Add Member to Your Workspace
                  </button>
                )}
              </div>
            </div>

            {teamLeaderAssignmentsError ? (
              <p className="hr-reporting-message" role="alert">
                {teamLeaderAssignmentsError}
              </p>
            ) : teamLeaderAssignments.length === 0 ? (
              <div className="hr-reporting-empty">
                <Users size={21} />

                <strong>No Team Leaders assigned yet</strong>

                <p>
                  Use Add Member to Your Workspace to select an available Team
                  Leader from your Company workspace.
                </p>
              </div>
            ) : (
              <div className="hr-reporting-roster-grid">
                {teamLeaderAssignments.map((assignment) => {
                  const leaderName =
                    assignment.team_leader_name || "Team Leader";

                  const initials = leaderName
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0] || "")
                    .join("")
                    .toUpperCase();

                  const status = String(
                    assignment.team_leader_account_status || "UNKNOWN",
                  ).toUpperCase();

                  const leaderId = Number(assignment.team_leader_user_id);

                  const leaderTeams = teams
                    .filter((team) => {
                      const teamLeaderId =
                        team.team_leader_user_id ??
                        team.team_leader_id ??
                        team.teamLeaderId ??
                        team.leader_user_id ??
                        team.leader_id ??
                        team.leaderId;

                      return (
                        teamLeaderId !== undefined &&
                        teamLeaderId !== null &&
                        Number(teamLeaderId) === leaderId
                      );
                    })
                    .map((team) => team.name || team.team_name || team.title)
                    .filter(Boolean);

                  return (
                    <article
                      className="hr-reporting-person"
                      key={
                        assignment.assignment_id ??
                        assignment.id ??
                        assignment.team_leader_user_id
                      }
                    >
                      <span className="hr-reporting-avatar" aria-hidden="true">
                        {initials || "TL"}
                      </span>

                      <div className="hr-reporting-person-copy">
                        <strong>{leaderName}</strong>

                        <span className="hr-reporting-email">
                          {assignment.team_leader_email || "No email available"}
                        </span>

                        <small>
                          Teams:{" "}
                          {leaderTeams.length
                            ? leaderTeams.join(", ")
                            : "No linked team found"}
                        </small>
                      </div>

                      <span
                        className={`hr-reporting-status ${
                          status === "ACTIVE" ? "is-active" : "is-inactive"
                        }`}
                      >
                        <i aria-hidden="true" />

                        {status === "ACTIVE"
                          ? "Active"
                          : status === "INACTIVE"
                            ? "Inactive"
                            : status === "SUSPENDED"
                              ? "Suspended"
                              : status.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <div className="hr-directory-table-wrap">
            <table className="hr-directory-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Activity</th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="hr-directory-empty">
                      {normalizedQuery
                        ? "No employees match your search."
                        : "Employee records will appear here when available."}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.slice(0, 7).map((member) => {
                    const memberId =
                      member.user_id ?? member.userId ?? member.id;

                    const assignedTeams = memberTeamMap[String(memberId)] || [];

                    const accountStatus = getAccountStatus(member);

                    const role = getMemberRole(member);

                    const activityValue =
                      member.last_activity_at ||
                      member.last_active_at ||
                      member.last_seen_at;

                    return (
                      <tr
                        key={
                          member.workspace_membership_id ??
                          member.id ??
                          member.user_id
                        }
                        onClick={() => openMemberTeam(member)}
                      >
                        <td>
                          <div className="hr-member-identity">
                            <span className="hr-member-avatar">
                              {getInitials(getMemberName(member))}
                            </span>

                            <span className="hr-member-copy">
                              <strong>{getMemberName(member)}</strong>

                              <small>
                                {member.email || "Email unavailable"}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`hr-role-badge hr-role-badge-${role.toLowerCase().replace(/_/g, "-")}`}
                          >
                            {getRoleLabel(role)}
                          </span>
                        </td>

                        <td>
                          <span className="hr-team-cell">
                            {assignedTeams.length > 0
                              ? assignedTeams
                                  .slice(0, 2)
                                  .map((team) => team.name)
                                  .join(", ")
                              : "—"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`hr-account-status ${
                              accountStatus === "active"
                                ? "hr-status-active"
                                : "hr-status-other"
                            }`}
                          >
                            <i />

                            {formatAccountStatus(accountStatus)}
                          </span>
                        </td>

                        <td>
                          <span className="hr-member-activity">
                            {formatRelativeTime(activityValue)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredMembers.length > 7 && (
            <div className="hr-directory-footer">
              Showing 7 of {filteredMembers.length} employees.
              <span>Use search to locate a specific employee.</span>
            </div>
          )}

          <button
            type="button"
            className="hr-panel-bottom-link"
            onClick={() => navigate("/teams")}
          >
            Open team management
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ONBOARDING & ACCOUNT READINESS */}

        <article className="hr-panel hr-readiness-panel">
          <div className="hr-panel-heading">
            <div>
              <span className="hr-panel-eyebrow">PEOPLE READINESS</span>

              <h2>Workforce Overview</h2>

              <p>Team assignment and account status.</p>
            </div>

            <span className="hr-panel-heading-icon">
              <ShieldCheck size={17} />
            </span>
          </div>

          <div className="hr-readiness-highlight">
            <div className="hr-readiness-highlight-copy">
              <span>Active Accounts</span>

              <strong>{activeMembers.length}</strong>

              <small>of {members.length} employees</small>
            </div>

            <div
              className="hr-readiness-ring"
              style={{
                "--hr-readiness-angle": `${activeAccountAngle}deg`,
              }}
              role="img"
              aria-label={`${activeMembers.length} of ${members.length} employee accounts are active`}
            >
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="hr-readiness-grid">
            <div className="hr-readiness-card hr-readiness-assigned">
              <span className="hr-readiness-card-icon">
                <Users size={16} />
              </span>

              <strong>{teamAssignedMembers.length}</strong>

              <span>Team assigned</span>

              <small>Employees linked to a team</small>
            </div>

            <div className="hr-readiness-card hr-readiness-review">
              <span className="hr-readiness-card-icon">
                <ShieldCheck size={16} />
              </span>

              <strong>{otherStatusMembers.length}</strong>

              <span>Other account statuses</span>

              <small>Accounts not marked active</small>
            </div>

            <div className="hr-readiness-card hr-readiness-teams">
              <span className="hr-readiness-card-icon">
                <Layers size={16} />
              </span>

              <strong>{teams.length}</strong>

              <span>Available teams</span>

              <small>Teams in this workspace</small>
            </div>

            <div className="hr-readiness-card hr-readiness-unassigned">
              <span className="hr-readiness-card-icon">
                <UserRound size={16} />
              </span>

              <strong>{membersWithoutTeam}</strong>

              <span>No team linked</span>

              <small>Review team assignments</small>
            </div>
          </div>

          <div className="hr-readiness-note">
            <Sparkles size={14} />

            <p>
              These figures reflect current account and team records. A separate
              onboarding-stage API is needed to report invitation and onboarding
              progress accurately.
            </p>
          </div>

          <button
            type="button"
            className="hr-panel-bottom-link"
            onClick={() => navigate("/teams")}
          >
            Review team assignments
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}

        <article className="hr-panel hr-quick-actions-panel">
          <div className="hr-panel-heading">
            <div>
              <span className="hr-panel-eyebrow">HR WORKSPACE</span>

              <h2>Quick Actions</h2>

              <p>Shortcuts for everyday people operations.</p>
            </div>

            <span className="hr-panel-heading-icon">
              <Sparkles size={17} />
            </span>
          </div>

          <div className="hr-quick-actions-grid">
            {/* CREATE PROJECT */}

            {canCreateCompanyContent && (
              <button
                type="button"
                className="hr-quick-action"
                onClick={handleCreateProject}
              >
                <span className="hr-quick-action-icon hr-action-cyan">
                  <FolderKanban size={18} />
                </span>

                <span className="hr-quick-action-copy">
                  <strong>Create Project</strong>

                  <small>Start a new Company project</small>
                </span>

                <ChevronRight size={15} />
              </button>
            )}

            {/* CREATE TASK */}

            {canCreateCompanyContent && (
              <button
                type="button"
                className="hr-quick-action"
                onClick={handleOpenCreateTaskModal}
              >
                <span className="hr-quick-action-icon hr-action-blue">
                  <CheckCircle2 size={18} />
                </span>

                <span className="hr-quick-action-copy">
                  <strong>Create Task</strong>

                  <small>Choose one of your projects</small>
                </span>

                <ChevronRight size={15} />
              </button>
            )}

            {/* EMPLOYEE DIRECTORY */}

            <button
              type="button"
              className="hr-quick-action"
              onClick={scrollToDirectory}
            >
              <span className="hr-quick-action-icon hr-action-cyan">
                <Users size={18} />
              </span>

              <span className="hr-quick-action-copy">
                <strong>Employee Directory</strong>

                <small>Review employee records</small>
              </span>

              <ChevronRight size={15} />
            </button>

            {/* ADD MEMBER ACTION */}

            {canAddMemberToWorkspace && (
              <button
                type="button"
                className="hr-quick-action"
                onClick={handleOpenAddMemberModal}
              >
                <span className="hr-quick-action-icon hr-action-cyan">
                  <UserPlus size={18} />
                </span>

                <span className="hr-quick-action-copy">
                  <strong>Add Member to Your Workspace</strong>

                  <small>Add an available Team Leader</small>
                </span>

                <ChevronRight size={15} />
              </button>
            )}

            {/* TEAM MANAGEMENT */}

            <button
              type="button"
              className="hr-quick-action"
              onClick={() => navigate("/teams")}
            >
              <span className="hr-quick-action-icon hr-action-violet">
                <Layers size={18} />
              </span>

              <span className="hr-quick-action-copy">
                <strong>Assign & Review Teams</strong>

                <small>Open team management</small>
              </span>

              <ChevronRight size={15} />
            </button>

            {/* NOTIFICATIONS */}

            <button
              type="button"
              className="hr-quick-action"
              onClick={() => navigate("/notifications")}
            >
              <span className="hr-quick-action-icon hr-action-blue">
                <Bell size={18} />
              </span>

              <span className="hr-quick-action-copy">
                <strong>People Activity</strong>

                <small>Review notifications</small>
              </span>

              <ChevronRight size={15} />
            </button>

            {/* ACCOUNT SETTINGS */}

            <button
              type="button"
              className="hr-quick-action"
              onClick={() => navigate("/profile")}
            >
              <span className="hr-quick-action-icon hr-action-purple">
                <Settings size={18} />
              </span>

              <span className="hr-quick-action-copy">
                <strong>Account Settings</strong>

                <small>Manage your profile</small>
              </span>

              <ChevronRight size={15} />
            </button>
          </div>
        </article>

        {/* ORGANIZATION FOOTER CARD */}

        <article className="hr-panel hr-organization-panel">
          <div className="hr-organization-icon">
            <BriefcaseBusiness size={20} />
          </div>

          <div className="hr-organization-copy">
            <span className="hr-panel-eyebrow">CURRENT WORKSPACE</span>

            <h2>
              {workspaceName || activeWorkspace?.name || "Company Workspace"}
            </h2>

            <p>
              {workspaceRole || "HR"} workspace access · {members.length}{" "}
              organization members · {teams.length} teams
            </p>
          </div>

          <button
            type="button"
            className="hr-organization-button"
            onClick={() => navigate("/profile")}
          >
            My Profile
            <ArrowRight size={14} />
          </button>
        </article>
      </section>

      {/* ======================================================
          ADD MEMBER MODAL
      ====================================================== */}

      {showAddMemberModal && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !addingTeamLeader) {
              handleCloseAddMemberModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(5, 10, 22, 0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hr-add-member-title"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "28px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "18px",
              background: "#111827",
              color: "#f8fafc",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "22px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#60a5fa",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                  }}
                >
                  HR WORKSPACE
                </span>

                <h2
                  id="hr-add-member-title"
                  style={{
                    margin: 0,
                    fontSize: "21px",
                    fontWeight: 650,
                  }}
                >
                  Add Member to Your Workspace
                </h2>

                <p
                  style={{
                    margin: "9px 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Choose an available active Team Leader, or create a new Team
                  Leader account and invite them to join your Company workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseAddMemberModal}
                disabled={
                  addingTeamLeader ||
                  creatingTeamLeader ||
                  retryingTeamLeaderInvitation
                }
                aria-label="Close"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "9px",
                  background: "rgba(148, 163, 184, 0.08)",
                  color: "#cbd5e1",
                  cursor:
                    addingTeamLeader ||
                    creatingTeamLeader ||
                    retryingTeamLeaderInvitation
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>

            {addMemberSuccess && (
              <div
                role="status"
                style={{
                  marginBottom: "16px",
                  padding: "12px 13px",
                  border: "1px solid rgba(52, 211, 153, 0.28)",
                  borderRadius: "9px",
                  background: "rgba(6, 78, 59, 0.18)",
                  color: "#6ee7b7",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                {addMemberSuccess}
              </div>
            )}

            {/* MODAL FORM */}

            {showCreateTeamLeaderForm ? (
              <div>
                {createdTeamLeader ? (
                  <div
                    style={{
                      padding: "15px",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "10px",
                      background: "rgba(120, 53, 15, 0.16)",
                      marginBottom: "18px",
                    }}
                  >
                    <strong style={{ color: "#fcd34d", fontSize: "13px" }}>
                      Account created — invitation pending
                    </strong>
                    <p
                      style={{
                        color: "#cbd5e1",
                        fontSize: "12px",
                        lineHeight: 1.6,
                      }}
                    >
                      The account for {createdTeamLeader.name} (
                      {createdTeamLeader.email}) already exists. Retry only the
                      invitation; do not create this account again.
                    </p>
                    <div
                      style={{
                        marginTop: "10px",
                        color: "#e2e8f0",
                        fontSize: "12px",
                      }}
                    >
                      <strong>Temporary password:</strong>{" "}
                      <code>{createdTeamLeader.password}</code>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetryTeamLeaderInvitation}
                      disabled={retryingTeamLeaderInvitation}
                      style={{
                        marginTop: "14px",
                        minHeight: "39px",
                        padding: "0 14px",
                        border: "none",
                        borderRadius: "9px",
                        background: "linear-gradient(135deg, #b45309, #d97706)",
                        color: "#fff",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: retryingTeamLeaderInvitation
                          ? "not-allowed"
                          : "pointer",
                      }}
                    >
                      {retryingTeamLeaderInvitation
                        ? "Retrying invitation..."
                        : "Retry Invitation"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateTeamLeader}>
                    <div style={{ display: "grid", gap: "14px" }}>
                      {[
                        {
                          field: "name",
                          label: "Full Name",
                          type: "text",
                          placeholder: "Enter full name",
                        },
                        {
                          field: "email",
                          label: "Email Address",
                          type: "email",
                          placeholder: "Enter email address",
                        },
                        {
                          field: "password",
                          label: "Temporary Password",
                          type: "password",
                          placeholder: "At least 6 characters",
                        },
                      ].map((item) => (
                        <label key={item.field} style={{ display: "block" }}>
                          <span
                            style={{
                              display: "block",
                              marginBottom: "8px",
                              color: "#cbd5e1",
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                          >
                            {item.label}
                          </span>
                          <input
                            type={item.type}
                            value={teamLeaderForm[item.field]}
                            onChange={(event) =>
                              updateTeamLeaderForm(
                                item.field,
                                event.target.value,
                              )
                            }
                            placeholder={item.placeholder}
                            required
                            minLength={
                              item.field === "password" ? 6 : undefined
                            }
                            autoComplete={
                              item.field === "password"
                                ? "new-password"
                                : item.field === "email"
                                  ? "email"
                                  : "name"
                            }
                            disabled={creatingTeamLeader}
                            style={{
                              width: "100%",
                              minHeight: "45px",
                              boxSizing: "border-box",
                              padding: "0 13px",
                              border: "1px solid rgba(148, 163, 184, 0.24)",
                              borderRadius: "10px",
                              outline: "none",
                              background: "#1e293b",
                              color: "#f8fafc",
                              fontSize: "13px",
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleAddMemberToWorkspace}>
                <div style={{ marginBottom: "18px" }}>
                  <label
                    htmlFor="hr-available-team-leader"
                    style={{
                      display: "block",
                      marginBottom: "9px",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Select Team Leader
                  </label>

                  {loadingAvailableTeamLeaders ? (
                    <div
                      style={{
                        padding: "16px",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                        borderRadius: "10px",
                        color: "#94a3b8",
                        fontSize: "13px",
                      }}
                    >
                      Loading available Team Leaders...
                    </div>
                  ) : availableTeamLeaders.length > 0 ? (
                    <select
                      id="hr-available-team-leader"
                      value={selectedTeamLeaderId}
                      onChange={(event) =>
                        setSelectedTeamLeaderId(event.target.value)
                      }
                      disabled={addingTeamLeader}
                      required
                      style={{
                        width: "100%",
                        minHeight: "46px",
                        padding: "0 13px",
                        border: "1px solid rgba(148, 163, 184, 0.24)",
                        borderRadius: "10px",
                        outline: "none",
                        background: "#1e293b",
                        color: "#f8fafc",
                        fontSize: "13px",
                      }}
                    >
                      <option value="">Choose a Team Leader</option>

                      {availableTeamLeaders.map((leader) => (
                        <option
                          key={leader.user_id}
                          value={String(leader.user_id)}
                        >
                          {leader.name}
                          {leader.email ? ` — ${leader.email}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div
                      style={{
                        padding: "15px",
                        border: "1px solid rgba(148, 163, 184, 0.18)",
                        borderRadius: "10px",
                        color: "#94a3b8",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      No unassigned active Team Leaders are available in this
                      Company workspace.
                    </div>
                  )}
                </div>

                {availableTeamLeaders.length === 0 &&
                  !loadingAvailableTeamLeaders && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateTeamLeaderForm(true);
                        setAddMemberError("");
                        setAddMemberSuccess("");
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        minHeight: "40px",
                        padding: "0 14px",
                        border: "1px solid rgba(45, 212, 191, 0.3)",
                        borderRadius: "9px",
                        background: "rgba(45, 212, 191, 0.08)",
                        color: "#7ce6d8",
                        fontSize: "12px",
                        fontWeight: 650,
                        cursor: "pointer",
                      }}
                    >
                      <UserPlus size={15} />
                      Create Team Leader
                    </button>
                  )}

                {/* ERROR */}

                {addMemberError && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "18px",
                      padding: "12px 13px",
                      border: "1px solid rgba(248, 113, 113, 0.25)",
                      borderRadius: "9px",
                      background: "rgba(127, 29, 29, 0.18)",
                      color: "#fca5a5",
                      fontSize: "12px",
                      lineHeight: 1.5,
                    }}
                  >
                    {addMemberError}
                  </div>
                )}

                {/* ACTIONS */}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseAddMemberModal}
                    disabled={addingTeamLeader}
                    style={{
                      minHeight: "40px",
                      padding: "0 16px",
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      borderRadius: "9px",
                      background: "transparent",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: addingTeamLeader ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      addingTeamLeader ||
                      loadingAvailableTeamLeaders ||
                      availableTeamLeaders.length === 0 ||
                      !selectedTeamLeaderId
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "40px",
                      padding: "0 17px",
                      border: "none",
                      borderRadius: "9px",
                      background:
                        addingTeamLeader ||
                        loadingAvailableTeamLeaders ||
                        availableTeamLeaders.length === 0 ||
                        !selectedTeamLeaderId
                          ? "#334155"
                          : "linear-gradient(135deg, #0891b2, #0d9488)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 650,
                      cursor:
                        addingTeamLeader ||
                        loadingAvailableTeamLeaders ||
                        availableTeamLeaders.length === 0 ||
                        !selectedTeamLeaderId
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        addingTeamLeader ||
                        loadingAvailableTeamLeaders ||
                        availableTeamLeaders.length === 0 ||
                        !selectedTeamLeaderId
                          ? 0.65
                          : 1,
                    }}
                  >
                    <UserPlus size={15} />

                    {addingTeamLeader ? "Adding..." : "Add to My Workspace"}
                  </button>
                </div>
              </form>
            )}

            {showCreateTeamLeaderForm && addMemberError && (
              <div
                role="alert"
                style={{
                  marginTop: "16px",
                  padding: "12px 13px",
                  border: "1px solid rgba(248, 113, 113, 0.25)",
                  borderRadius: "9px",
                  background: "rgba(127, 29, 29, 0.18)",
                  color: "#fca5a5",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                {addMemberError}
              </div>
            )}

            {showCreateTeamLeaderForm && !createdTeamLeader && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "22px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateTeamLeaderForm(false);
                    setTeamLeaderForm({ name: "", email: "", password: "" });
                    setAddMemberError("");
                  }}
                  disabled={creatingTeamLeader}
                  style={{
                    minHeight: "40px",
                    padding: "0 16px",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "9px",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: creatingTeamLeader ? "not-allowed" : "pointer",
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    const form = event.currentTarget
                      .closest("section")
                      ?.querySelector("form");
                    form?.requestSubmit();
                  }}
                  disabled={
                    creatingTeamLeader ||
                    !teamLeaderForm.name.trim() ||
                    !teamLeaderForm.email.trim() ||
                    teamLeaderForm.password.length < 6
                  }
                  style={{
                    minHeight: "40px",
                    padding: "0 17px",
                    border: "none",
                    borderRadius: "9px",
                    background:
                      creatingTeamLeader ||
                      !teamLeaderForm.name.trim() ||
                      !teamLeaderForm.email.trim() ||
                      teamLeaderForm.password.length < 6
                        ? "#334155"
                        : "linear-gradient(135deg, #0891b2, #0d9488)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor: creatingTeamLeader ? "not-allowed" : "pointer",
                    opacity:
                      creatingTeamLeader ||
                      !teamLeaderForm.name.trim() ||
                      !teamLeaderForm.email.trim() ||
                      teamLeaderForm.password.length < 6
                        ? 0.65
                        : 1,
                  }}
                >
                  {creatingTeamLeader
                    ? "Creating & inviting..."
                    : "Create & Send Invitation"}
                </button>
              </div>
            )}

            {showCreateTeamLeaderForm && createdTeamLeader && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseAddMemberModal}
                  disabled={retryingTeamLeaderInvitation}
                  style={{
                    minHeight: "40px",
                    padding: "0 16px",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "9px",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================
          CREATE TASK PROJECT SELECTOR
      ====================================================== */}

      {showCreateTaskModal && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseCreateTaskModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(5, 10, 22, 0.78)",
            backdropFilter: "blur(8px)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hr-create-task-title"
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "28px",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "18px",
              background: "#111827",
              color: "#f8fafc",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
                marginBottom: "22px",
              }}
            >
              <div>
                <span
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#60a5fa",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                  }}
                >
                  HR WORKSPACE
                </span>

                <h2
                  id="hr-create-task-title"
                  style={{
                    margin: 0,
                    fontSize: "21px",
                    fontWeight: 650,
                  }}
                >
                  Create a Task
                </h2>

                <p
                  style={{
                    margin: "9px 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Select a project originally created by you. You can then
                  create a task inside that project.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseCreateTaskModal}
                aria-label="Close"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "34px",
                  height: "34px",
                  flexShrink: 0,
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: "9px",
                  background: "rgba(148, 163, 184, 0.08)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>

            {hrCreatedProjects.length > 0 ? (
              <form onSubmit={handleContinueToCreateTask}>
                <div style={{ marginBottom: "18px" }}>
                  <label
                    htmlFor="hr-create-task-project"
                    style={{
                      display: "block",
                      marginBottom: "9px",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Select Your Project
                  </label>

                  <select
                    id="hr-create-task-project"
                    value={selectedTaskProjectId}
                    onChange={(event) => {
                      setSelectedTaskProjectId(event.target.value);
                      setCreateTaskModalError("");
                    }}
                    required
                    style={{
                      width: "100%",
                      minHeight: "46px",
                      padding: "0 13px",
                      border: "1px solid rgba(148, 163, 184, 0.24)",
                      borderRadius: "10px",
                      outline: "none",
                      background: "#1e293b",
                      color: "#f8fafc",
                      fontSize: "13px",
                    }}
                  >
                    <option value="">Choose a project</option>

                    {hrCreatedProjects.map((project) => {
                      const projectId = getId(project);

                      return (
                        <option key={projectId} value={String(projectId)}>
                          {project.name || `Project #${projectId}`}
                        </option>
                      );
                    })}
                  </select>

                  <p
                    style={{
                      margin: "9px 0 0",
                      color: "#94a3b8",
                      fontSize: "12px",
                      lineHeight: 1.5,
                    }}
                  >
                    {hrCreatedProjects.length} project
                    {hrCreatedProjects.length === 1 ? "" : "s"} created by you{" "}
                    available.
                  </p>
                </div>

                {createTaskModalError && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "18px",
                      padding: "12px 13px",
                      border: "1px solid rgba(248, 113, 113, 0.25)",
                      borderRadius: "9px",
                      background: "rgba(127, 29, 29, 0.18)",
                      color: "#fca5a5",
                      fontSize: "12px",
                      lineHeight: 1.5,
                    }}
                  >
                    {createTaskModalError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseCreateTaskModal}
                    style={{
                      minHeight: "40px",
                      padding: "0 16px",
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      borderRadius: "9px",
                      background: "transparent",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!selectedTaskProjectId}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "40px",
                      padding: "0 17px",
                      border: "none",
                      borderRadius: "9px",
                      background: selectedTaskProjectId
                        ? "linear-gradient(135deg, #0891b2, #4f46e5)"
                        : "#334155",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 650,
                      cursor: selectedTaskProjectId ? "pointer" : "not-allowed",
                      opacity: selectedTaskProjectId ? 1 : 0.65,
                    }}
                  >
                    Continue
                    <ArrowRight size={15} />
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div
                  style={{
                    padding: "17px",
                    border: "1px solid rgba(148, 163, 184, 0.18)",
                    borderRadius: "10px",
                    background: "rgba(148, 163, 184, 0.045)",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  You haven't created any projects yet. Create your first
                  project, then return here to create tasks inside it.
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "22px",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseCreateTaskModal}
                    style={{
                      minHeight: "40px",
                      padding: "0 16px",
                      border: "1px solid rgba(148, 163, 184, 0.25)",
                      borderRadius: "9px",
                      background: "transparent",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleCloseCreateTaskModal();
                      handleCreateProject();
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minHeight: "40px",
                      padding: "0 17px",
                      border: "none",
                      borderRadius: "9px",
                      background: "linear-gradient(135deg, #0891b2, #0d9488)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 650,
                      cursor: "pointer",
                    }}
                  >
                    <FolderKanban size={15} />
                    Create Project
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="hr-dashboard-footer">
        <span>
          <strong>ZYRA</strong>
          <i>/</i>
          PEOPLE INTELLIGENCE
        </span>

        <span>
          <i className="hr-footer-status-dot" />
          COMPANY HR WORKSPACE
        </span>
      </footer>
    </main>
  );
}

export default HRDash;
