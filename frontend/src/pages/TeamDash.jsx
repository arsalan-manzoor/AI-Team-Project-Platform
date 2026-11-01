import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  FolderKanban,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";
import { apiRequest } from "../services/api";

import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/TeamDash.css";

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

const BLOCKED_STATUSES = new Set(["blocked", "on_hold", "on hold"]);

const PRIORITY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/* ============================================================
   DATA HELPERS
============================================================ */

function getArray(value, preferredKey) {
  if (Array.isArray(value)) {
    return value;
  }

  if (preferredKey && Array.isArray(value?.[preferredKey])) {
    return value[preferredKey];
  }

  if (Array.isArray(value?.data)) {
    return value.data;
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

  if (Array.isArray(value?.members)) {
    return value.members;
  }

  if (Array.isArray(value?.notifications)) {
    return value.notifications;
  }

  return [];
}

function getId(item) {
  return item?.id ?? item?.task_id ?? item?.project_id ?? item?.team_id;
}

function getTaskId(task) {
  return task?.id ?? task?.task_id;
}

function getProjectId(task) {
  return task?.project_id ?? task?.projectId;
}

function normalizeStatus(status) {
  return String(status || "todo")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isCompleted(task) {
  return COMPLETED_STATUSES.has(normalizeStatus(task?.status));
}

function isActive(task) {
  return ACTIVE_STATUSES.has(normalizeStatus(task?.status));
}

function isBlocked(task) {
  return BLOCKED_STATUSES.has(normalizeStatus(task?.status));
}

function getPriority(task) {
  const priority = String(task?.priority || "medium")
    .trim()
    .toLowerCase();

  return Object.prototype.hasOwnProperty.call(PRIORITY_ORDER, priority)
    ? priority
    : "medium";
}

function getPriorityLabel(task) {
  const priority = getPriority(task);

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getTaskTitle(task) {
  return task?.title || task?.name || "Untitled task";
}

function getMemberId(member) {
  return member?.user_id ?? member?.userId ?? member?.member_id ?? member?.id;
}

function getMemberName(member) {
  return (
    member?.name ||
    member?.user_name ||
    member?.username ||
    member?.email ||
    "Team Member"
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

function getDueDate(task) {
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

function isOverdue(task) {
  const dueDate = getDueDate(task);

  if (!dueDate || isCompleted(task)) {
    return false;
  }

  const today = new Date();

  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );

  const currentDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return dueDay < currentDay;
}

function formatDueDate(task) {
  const date = getDueDate(task);

  if (!date) {
    return "No due date";
  }

  const today = new Date();

  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const currentDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const tomorrow = new Date(currentDay);

  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dueDay.getTime() === currentDay.getTime()) {
    return "Today";
  }

  if (dueDay.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function formatRelativeTime(value) {
  if (!value) {
    return "Recent";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recent";
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

function getAssigneeId(task) {
  return (
    task?.assigned_to ?? task?.assignedTo ?? task?.assignee_id ?? task?.user_id
  );
}

function getAssigneeName(task, memberMap) {
  const embeddedMember =
    task?.assignee || task?.assigned_user || task?.assignedUser;

  if (embeddedMember?.name || embeddedMember?.email) {
    return getMemberName(embeddedMember);
  }

  const assigneeId = getAssigneeId(task);

  if (assigneeId !== undefined && assigneeId !== null) {
    const member = memberMap.get(String(assigneeId));

    if (member) {
      return getMemberName(member);
    }
  }

  return "Unassigned";
}

function getNotificationTitle(notification) {
  return notification?.title || "Team update";
}

function getNotificationMessage(notification) {
  return notification?.message || "A workspace notification is available.";
}

/* ============================================================
   TEAM LEADER DASHBOARD
============================================================ */

function TeamDash() {
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

  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  /* ==========================================================
     LOAD WORKSPACE DATA

     Existing frontend services are reused.

     This component does not change backend endpoints,
     database behavior, authentication, or permissions.
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (workspaceLoading) {
        return;
      }

      if (!workspaceId) {
        setUser(null);
        setTeams([]);
        setProjects([]);
        setTasks([]);
        setTeamMembers([]);
        setNotifications([]);

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
        notificationsResult,
      ] = results;

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

      const allNotifications =
        notificationsResult.status === "fulfilled"
          ? getArray(notificationsResult.value, "notifications")
          : [];

      /*
       * First identify teams belonging to the active workspace.
       */

      const workspaceTeams = allTeams.filter(
        (team) =>
          team.workspace_id !== undefined &&
          team.workspace_id !== null &&
          Number(team.workspace_id) === Number(workspaceId),
      );

      const workspaceTeamIds = new Set(
        workspaceTeams.map((team) => Number(getId(team))),
      );

      /*
       * Projects are scoped using their team relationship.
       * If a project explicitly reports workspace_id, use it.
       */

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

      /*
       * Scope tasks to projects in the active workspace.
       */

      const workspaceTasks = allTasks.filter((task) =>
        workspaceProjectIds.has(Number(getProjectId(task))),
      );

      /*
       * Get members of workspace teams using the existing service.
       */

      const memberResults = await Promise.allSettled(
        workspaceTeams.map((team) => getTeamMembers(getId(team))),
      );

      if (cancelled) {
        return;
      }

      let membershipRequestFailed = false;

      const collectedMembers = [];

      memberResults.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          membershipRequestFailed = true;
          return;
        }

        const team = workspaceTeams[index];

        const teamMemberList = getArray(result.value, "members");

        teamMemberList.forEach((member) => {
          collectedMembers.push({
            ...member,

            team_id: member.team_id ?? member.teamId ?? getId(team),

            team_name:
              member.team_name ?? member.teamName ?? team.name ?? "Team",
          });
        });
      });

      /*
       * Merge repeated memberships for people who belong to
       * more than one team, preserving their team information.
       */

      const uniqueMemberMap = new Map();

      collectedMembers.forEach((member) => {
        const memberId = getMemberId(member);

        if (memberId === undefined || memberId === null) {
          return;
        }

        const key = String(memberId);

        if (!uniqueMemberMap.has(key)) {
          uniqueMemberMap.set(key, {
            ...member,
            teamNames: [],
            teamIds: [],
          });
        }

        const existing = uniqueMemberMap.get(key);

        const teamId = member.team_id ?? member.teamId;

        const teamName = member.team_name ?? member.teamName;

        if (teamName && !existing.teamNames.includes(teamName)) {
          existing.teamNames.push(teamName);
        }

        if (
          teamId !== undefined &&
          teamId !== null &&
          !existing.teamIds.includes(Number(teamId))
        ) {
          existing.teamIds.push(Number(teamId));
        }
      });

      const normalizedMembers = Array.from(uniqueMemberMap.values());

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
      setTeams(workspaceTeams);
      setProjects(workspaceProjects);
      setTasks(workspaceTasks);
      setTeamMembers(normalizedMembers);
      setNotifications(sortedNotifications);

      const requestsFailed =
        userResult.status === "rejected" ||
        projectsResult.status === "rejected" ||
        teamsResult.status === "rejected" ||
        tasksResult.status === "rejected" ||
        notificationsResult.status === "rejected" ||
        membershipRequestFailed;

      if (requestsFailed) {
        setError(
          "Some team information could not be loaded. Refresh to try again.",
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
     DERIVED DATA
  ========================================================== */

  const completedTasks = useMemo(() => tasks.filter(isCompleted), [tasks]);

  const activeTasks = useMemo(() => tasks.filter(isActive), [tasks]);

  const blockedTasks = useMemo(() => tasks.filter(isBlocked), [tasks]);

  const overdueTasks = useMemo(() => tasks.filter(isOverdue), [tasks]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !isCompleted(task) && !isBlocked(task)),
    [tasks],
  );

  const completionRate = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const memberMap = useMemo(() => {
    const map = new Map();

    teamMembers.forEach((member) => {
      const memberId = getMemberId(member);

      if (memberId !== undefined && memberId !== null) {
        map.set(String(memberId), member);
      }
    });

    return map;
  }, [teamMembers]);

  const projectSummaries = useMemo(
    () =>
      projects.map((project) => {
        const projectId = Number(getId(project));

        const projectTasks = tasks.filter(
          (task) => Number(getProjectId(task)) === projectId,
        );

        const completed = projectTasks.filter(isCompleted).length;

        const projectTeam = teams.find(
          (team) => Number(getId(team)) === Number(project.team_id),
        );

        const progress = projectTasks.length
          ? Math.round((completed / projectTasks.length) * 100)
          : 0;

        return {
          ...project,

          displayId: getId(project),

          taskCount: projectTasks.length,

          completedCount: completed,

          activeCount: projectTasks.filter(isActive).length,

          blockedCount: projectTasks.filter(isBlocked).length,

          progress,

          teamName: projectTeam?.name || "Workspace project",
        };
      }),
    [projects, tasks, teams],
  );

  const memberWorkloads = useMemo(
    () =>
      teamMembers.map((member) => {
        const memberId = getMemberId(member);

        const assigned = tasks.filter(
          (task) =>
            getAssigneeId(task) !== undefined &&
            getAssigneeId(task) !== null &&
            String(getAssigneeId(task)) === String(memberId),
        );

        const completed = assigned.filter(isCompleted).length;

        const pending = assigned.filter((task) => !isCompleted(task)).length;

        const progress = assigned.length
          ? Math.round((completed / assigned.length) * 100)
          : 0;

        return {
          ...member,

          displayId: memberId,

          assignedCount: assigned.length,

          pendingCount: pending,

          completedCount: completed,

          progress,
        };
      }),
    [teamMembers, tasks],
  );

  const workloadMaximum = Math.max(
    1,
    ...memberWorkloads.map((member) => member.assignedCount),
  );

  const sortedPriorityTasks = useMemo(
    () =>
      [...openTasks].sort((first, second) => {
        const overdueDifference =
          Number(isOverdue(second)) - Number(isOverdue(first));

        if (overdueDifference !== 0) {
          return overdueDifference;
        }

        const priorityDifference =
          PRIORITY_ORDER[getPriority(first)] -
          PRIORITY_ORDER[getPriority(second)];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        const firstDue =
          getDueDate(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;

        const secondDue =
          getDueDate(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;

        return firstDue - secondDue;
      }),
    [openTasks],
  );

  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => getDueDate(task) && !isCompleted(task))
        .sort(
          (first, second) =>
            getDueDate(first).getTime() - getDueDate(second).getTime(),
        )
        .slice(0, 4),
    [tasks],
  );

  const attentionTasks = useMemo(() => {
    const combined = [...blockedTasks, ...overdueTasks];

    const uniqueTasks = new Map();

    combined.forEach((task) => {
      uniqueTasks.set(String(getTaskId(task)), task);
    });

    return Array.from(uniqueTasks.values()).slice(0, 4);
  }, [blockedTasks, overdueTasks]);

  const recentNotifications = notifications.slice(0, 4);

  const unreadCount = notifications.filter(
    (notification) =>
      notification.is_read === false || notification.is_read === 0,
  ).length;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredProjects = useMemo(
    () =>
      projectSummaries.filter((project) => {
        const searchable = [
          project.name,
          project.description,
          project.teamName,
          project.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      }),
    [projectSummaries, normalizedQuery],
  );

  const filteredMembers = useMemo(
    () =>
      memberWorkloads.filter((member) => {
        const searchable = [
          getMemberName(member),
          member.email,
          ...(member.teamNames || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      }),
    [memberWorkloads, normalizedQuery],
  );

  const todayLabel = new Date().toLocaleDateString("en-IN", {
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
     NAVIGATION HELPERS
  ========================================================== */

  function refreshDashboard() {
    setRefreshKey((current) => current + 1);
  }

  function openTask(task) {
    const taskId = getTaskId(task);
    const projectId = getProjectId(task);

    if (
      taskId !== undefined &&
      taskId !== null &&
      projectId !== undefined &&
      projectId !== null
    ) {
      navigate(`/projects/${projectId}/tasks/${taskId}`);

      return;
    }

    navigate("/tasks");
  }

  function openProject(project) {
    const projectId = getId(project);

    if (projectId !== undefined && projectId !== null) {
      navigate(`/projects/${projectId}`);
      return;
    }

    navigate("/projects");
  }

  function handleCreateTask() {
    if (projects.length === 1) {
      navigate(`/projects/${getId(projects[0])}/tasks/create`);

      return;
    }

    if (projects.length > 1) {
      navigate("/projects");
      return;
    }

    navigate("/projects/create");
  }

  function scrollToTeam() {
    document.getElementById("td-team-directory")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (workspaceLoading || loading) {
    return (
      <main className="td-dashboard">
        <section className="td-loading-panel">
          <div className="td-loading-orb">
            <Sparkles size={24} />
          </div>

          <span className="td-eyebrow">ZYRA / TEAM INTELLIGENCE</span>

          <h1>Preparing your team workspace</h1>

          <p>Connecting projects, tasks, team members, and recent activity.</p>

          <div className="td-loading-track">
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
    <main className="td-dashboard">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="td-page-header">
        <div className="td-header-copy">
          <div className="td-header-eyebrow">
            <span className="td-eyebrow">TEAM OPERATIONS</span>

            <span className="td-eyebrow-divider" />

            <span className="td-header-date">{todayLabel}</span>
          </div>

          <h1>Team Intelligence</h1>

          <p>
            {greeting}, {user?.name?.split(" ")[0] || "Team Leader"}. Here's
            your team's focus.
          </p>
        </div>

        <div className="td-header-actions">
          <label className="td-search-box">
            <Search size={15} />

            <input
              type="search"
              aria-label="Search projects and team members"
              placeholder="Search your team..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </label>

          <button
            type="button"
            className="td-header-icon-button"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
            onClick={refreshDashboard}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="td-header-icon-button td-notification-button"
            aria-label="Open notifications"
            title="Notifications"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={16} />

            {unreadCount > 0 && <span className="td-notification-dot" />}
          </button>

          <button
            type="button"
            className="td-profile-avatar"
            aria-label="Open profile"
            title="Open profile"
            onClick={() => navigate("/profile")}
          >
            {getInitials(user?.name || user?.email)}
          </button>
        </div>
      </header>

      {/* ======================================================
          PARTIAL DATA WARNING
      ====================================================== */}

      {error && (
        <div className="td-warning-banner" role="status">
          <AlertCircle size={16} />

          <span>{error}</span>

          <button type="button" onClick={refreshDashboard}>
            Retry
          </button>
        </div>
      )}

      {/* ======================================================
          BENTO GRID
      ====================================================== */}

      <section className="td-bento-grid" aria-label="Team leader dashboard">
        {/* ====================================================
            WELCOME PANEL
        ==================================================== */}

        <article className="td-welcome-panel">
          <div className="td-welcome-glow" />
          <div className="td-welcome-waves" />
          <div className="td-welcome-grid" />

          <div className="td-welcome-content">
            <span className="td-welcome-eyebrow">
              <Sparkles size={13} />
              TEAM INTELLIGENCE
            </span>

            <h2>
              Let's build
              <br />
              <span>something great.</span>
            </h2>

            <p>
              Keep your team aligned, track project progress, and focus on the
              work that matters.
            </p>

            <div className="td-workspace-chip">
              <span>
                <Layers size={13} />
              </span>

              <strong>
                {workspaceName || activeWorkspace?.name || "Company Workspace"}
              </strong>
            </div>

            <button
              type="button"
              className="td-welcome-button"
              onClick={handleCreateTask}
            >
              Create Task
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="td-welcome-art" aria-hidden="true">
            <div className="td-art-orbit td-art-orbit-one" />
            <div className="td-art-orbit td-art-orbit-two" />
            <div className="td-art-orbit td-art-orbit-three" />

            <div className="td-art-core">
              <Target size={27} />
            </div>

            <span className="td-art-node td-art-node-one">
              <CheckSquare size={14} />
            </span>

            <span className="td-art-node td-art-node-two">
              <Users size={14} />
            </span>

            <span className="td-art-node td-art-node-three">
              <Activity size={14} />
            </span>
          </div>
        </article>

        {/* ====================================================
            TEAM MEMBERS METRIC
        ==================================================== */}

        <button
          type="button"
          className="td-metric-card td-metric-members"
          onClick={scrollToTeam}
        >
          <span className="td-metric-topline">
            <span>Team Members</span>

            <span className="td-metric-icon">
              <Users size={17} />
            </span>
          </span>

          <strong className="td-metric-value">
            {teamMembers.length.toLocaleString("en-IN")}
          </strong>

          <span className="td-metric-caption">
            Across workspace teams
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            ACTIVE PROJECTS METRIC
        ==================================================== */}

        <button
          type="button"
          className="td-metric-card td-metric-projects"
          onClick={() => navigate("/projects")}
        >
          <span className="td-metric-topline">
            <span>Active Projects</span>

            <span className="td-metric-icon">
              <FolderKanban size={17} />
            </span>
          </span>

          <strong className="td-metric-value">
            {
              projectSummaries.filter((project) => {
                const status = normalizeStatus(project.status);

                return !["completed", "complete", "done", "archived"].includes(
                  status,
                );
              }).length
            }
          </strong>

          <span className="td-metric-caption">
            Project portfolio
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            TASKS IN PROGRESS METRIC
        ==================================================== */}

        <button
          type="button"
          className="td-metric-card td-metric-active"
          onClick={() => navigate("/tasks")}
        >
          <span className="td-metric-topline">
            <span>Tasks in Progress</span>

            <span className="td-metric-icon">
              <Activity size={17} />
            </span>
          </span>

          <strong className="td-metric-value">{activeTasks.length}</strong>

          <span className="td-metric-caption">
            Work currently underway
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            OVERDUE TASKS METRIC
        ==================================================== */}

        <button
          type="button"
          className="td-metric-card td-metric-overdue"
          onClick={() => navigate("/tasks")}
        >
          <span className="td-metric-topline">
            <span>Overdue Tasks</span>

            <span className="td-metric-icon">
              <Clock3 size={17} />
            </span>
          </span>

          <strong className="td-metric-value">{overdueTasks.length}</strong>

          <span className="td-metric-caption">
            Tasks past their due date
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            TEAM WORKLOAD PANEL
        ==================================================== */}

        <article className="td-panel td-workload-panel">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">PEOPLE & EXECUTION</span>

              <h2>Team Workload</h2>

              <p>Task assignments across your team.</p>
            </div>

            <span className="td-panel-icon">
              <Users size={16} />
            </span>
          </div>

          <div className="td-workload-summary">
            <div>
              <span>Tracked members</span>

              <strong>{teamMembers.length}</strong>
            </div>

            <div>
              <span>Assigned tasks</span>

              <strong>
                {
                  tasks.filter(
                    (task) =>
                      getAssigneeId(task) !== undefined &&
                      getAssigneeId(task) !== null,
                  ).length
                }
              </strong>
            </div>

            <div>
              <span>Completed</span>

              <strong>{completedTasks.length}</strong>
            </div>
          </div>

          <div className="td-workload-list">
            {memberWorkloads.length === 0 ? (
              <div className="td-empty-state">
                <Users size={22} />

                <strong>No team members to display</strong>

                <p>
                  Team member workload will appear here when membership records
                  are available.
                </p>
              </div>
            ) : (
              memberWorkloads
                .slice()
                .sort(
                  (first, second) => second.assignedCount - first.assignedCount,
                )
                .slice(0, 5)
                .map((member, index) => (
                  <div className="td-workload-member" key={member.displayId}>
                    <span
                      className={`td-member-avatar td-avatar-${(index % 4) + 1}`}
                    >
                      {getInitials(getMemberName(member))}
                    </span>

                    <div className="td-workload-member-info">
                      <div className="td-workload-name-line">
                        <strong>{getMemberName(member)}</strong>

                        <span>
                          {member.assignedCount}{" "}
                          {member.assignedCount === 1 ? "task" : "tasks"}
                        </span>
                      </div>

                      <div className="td-workload-track">
                        <span
                          style={{
                            width: `${
                              (member.assignedCount / workloadMaximum) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <span className="td-workload-progress">
                      {member.progress}%
                    </span>
                  </div>
                ))
            )}
          </div>

          <button
            type="button"
            className="td-panel-bottom-link"
            onClick={scrollToTeam}
          >
            View team directory
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ====================================================
            PROJECT INTELLIGENCE
        ==================================================== */}

        <article className="td-panel td-project-panel">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">DELIVERY OVERVIEW</span>

              <h2>Project Intelligence</h2>

              <p>Progress and outstanding team work.</p>
            </div>

            <button
              type="button"
              className="td-heading-action"
              onClick={() => navigate("/projects")}
            >
              All projects
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="td-project-summary">
            <div className="td-project-summary-ring">
              <div>
                <strong>{completionRate}%</strong>

                <span>COMPLETE</span>
              </div>
            </div>

            <div className="td-project-summary-copy">
              <strong>Workspace progress</strong>

              <span>
                {completedTasks.length} of {tasks.length} tasks completed
              </span>

              <div className="td-project-progress-track">
                <span
                  style={{
                    width: `${completionRate}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="td-project-list">
            {filteredProjects.length === 0 ? (
              <div className="td-empty-state">
                <FolderKanban size={22} />

                <strong>
                  {searchQuery
                    ? "No matching projects"
                    : "No projects available"}
                </strong>

                <p>
                  {searchQuery
                    ? "Try a different search term."
                    : "Projects belonging to this workspace will appear here."}
                </p>

                {!searchQuery && (
                  <button
                    type="button"
                    className="td-inline-action"
                    onClick={() => navigate("/projects/create")}
                  >
                    Create project
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            ) : (
              filteredProjects.slice(0, 4).map((project, index) => (
                <button
                  type="button"
                  className="td-project-row"
                  key={project.displayId}
                  onClick={() => openProject(project)}
                >
                  <span
                    className={`td-project-symbol td-project-symbol-${(index % 4) + 1}`}
                  >
                    <FolderKanban size={16} />
                  </span>

                  <span className="td-project-copy">
                    <strong>{project.name || "Untitled project"}</strong>

                    <small>
                      {project.teamName}
                      <span>·</span>
                      {project.completedCount}/{project.taskCount} tasks
                    </small>

                    <span className="td-project-row-track">
                      <span
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </span>
                  </span>

                  <span className="td-project-percent">
                    {project.progress}%
                    <ChevronRight size={13} />
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="td-panel-bottom-link"
            onClick={() => navigate("/projects")}
          >
            Explore projects
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ====================================================
            PRIORITIES & DEADLINES
        ==================================================== */}

        <article className="td-panel td-priority-panel">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">ATTENTION REQUIRED</span>

              <h2>Priority & Deadlines</h2>

              <p>Work that needs your attention.</p>
            </div>

            <span className="td-priority-heading-icon">
              <AlertCircle size={16} />
            </span>
          </div>

          <div className="td-priority-counters">
            <div>
              <span className="td-priority-counter-icon td-counter-red">
                <AlertCircle size={14} />
              </span>

              <span>
                <strong>{overdueTasks.length}</strong>

                <small>Overdue</small>
              </span>
            </div>

            <div>
              <span className="td-priority-counter-icon td-counter-violet">
                <Layers size={14} />
              </span>

              <span>
                <strong>{blockedTasks.length}</strong>

                <small>Blocked</small>
              </span>
            </div>
          </div>

          <div className="td-priority-list">
            {attentionTasks.length > 0 ? (
              attentionTasks.map((task, index) => (
                <button
                  type="button"
                  className="td-priority-task"
                  key={`${getTaskId(task)}-${index}`}
                  onClick={() => openTask(task)}
                >
                  <span
                    className={`td-priority-task-mark ${
                      isBlocked(task)
                        ? "td-task-mark-blocked"
                        : "td-task-mark-overdue"
                    }`}
                  />

                  <span className="td-priority-task-copy">
                    <strong>{getTaskTitle(task)}</strong>

                    <small>
                      {isBlocked(task) ? "Blocked task" : "Past due date"}
                    </small>
                  </span>

                  <ChevronRight size={13} />
                </button>
              ))
            ) : (
              <div className="td-priority-empty">
                <CheckCircle2 size={20} />

                <strong>Nothing urgent right now</strong>

                <span>Blocked and overdue tasks will appear here.</span>
              </div>
            )}
          </div>

          <div className="td-upcoming-heading">
            <span>Upcoming deadlines</span>

            <CalendarClock size={14} />
          </div>

          <div className="td-upcoming-list">
            {upcomingTasks.length === 0 ? (
              <p className="td-upcoming-empty">
                No dated incomplete tasks are available.
              </p>
            ) : (
              upcomingTasks.slice(0, 3).map((task) => (
                <button
                  type="button"
                  className="td-upcoming-task"
                  key={getTaskId(task)}
                  onClick={() => openTask(task)}
                >
                  <span className="td-upcoming-date">
                    {formatDueDate(task)}
                  </span>

                  <span>{getTaskTitle(task)}</span>

                  <ChevronRight size={12} />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="td-panel-bottom-link"
            onClick={() => navigate("/tasks")}
          >
            View all tasks
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ====================================================
            TEAM DIRECTORY
        ==================================================== */}

        <article className="td-panel td-directory-panel" id="td-team-directory">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">YOUR PEOPLE</span>

              <h2>Team Directory</h2>

              <p>Members and their current assigned workload.</p>
            </div>

            <button
              type="button"
              className="td-heading-action"
              onClick={() => navigate("/teams")}
            >
              View teams
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="td-directory-toolbar">
            <div className="td-directory-count">
              <Users size={15} />

              <strong>{filteredMembers.length}</strong>

              <span>members</span>
            </div>

            <label className="td-directory-search">
              <Search size={13} />

              <input
                type="search"
                aria-label="Search team members"
                placeholder="Filter members..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear member search"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={12} />
                </button>
              )}
            </label>
          </div>

          <div className="td-directory-table-wrap">
            <table className="td-directory-table">
              <thead>
                <tr>
                  <th>Member</th>

                  <th>Team</th>

                  <th>Assigned</th>

                  <th>Completed</th>

                  <th>Progress</th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="td-directory-empty">
                      {searchQuery
                        ? "No members match your search."
                        : "Team membership records will appear here."}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.slice(0, 7).map((member, index) => (
                    <tr key={member.displayId}>
                      <td>
                        <div className="td-member-identity">
                          <span
                            className={`td-member-avatar td-avatar-${(index % 4) + 1}`}
                          >
                            {getInitials(getMemberName(member))}
                          </span>

                          <span className="td-member-copy">
                            <strong>{getMemberName(member)}</strong>

                            <small>{member.email || "Team member"}</small>
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="td-member-team">
                          {(member.teamNames || []).join(", ") || "—"}
                        </span>
                      </td>

                      <td>
                        <span className="td-member-number">
                          {member.assignedCount}
                        </span>
                      </td>

                      <td>
                        <span className="td-member-number td-completed-number">
                          {member.completedCount}
                        </span>
                      </td>

                      <td>
                        <span className="td-table-progress">
                          <span className="td-table-progress-track">
                            <span
                              style={{
                                width: `${member.progress}%`,
                              }}
                            />
                          </span>

                          <small>{member.progress}%</small>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredMembers.length > 7 && (
            <div className="td-directory-footer">
              Showing 7 of {filteredMembers.length} members.
            </div>
          )}

          <button
            type="button"
            className="td-panel-bottom-link"
            onClick={() => navigate("/teams")}
          >
            Manage teams
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ====================================================
            RECENT TEAM ACTIVITY
        ==================================================== */}

        <article className="td-panel td-activity-panel">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">WORKSPACE SIGNALS</span>

              <h2>Recent Activity</h2>

              <p>Updates from your workspace notifications.</p>
            </div>

            <span className="td-panel-icon">
              <Activity size={16} />
            </span>
          </div>

          <div className="td-activity-list">
            {recentNotifications.length === 0 ? (
              <div className="td-activity-empty">
                <Activity size={22} />

                <strong>No recent activity</strong>

                <p>
                  Workspace updates will appear here when notifications are
                  available.
                </p>
              </div>
            ) : (
              recentNotifications.map((notification, index) => (
                <button
                  type="button"
                  className="td-activity-item"
                  key={notification.id ?? `${notification.title}-${index}`}
                  onClick={() => navigate("/notifications")}
                >
                  <span
                    className={`td-activity-icon td-activity-icon-${(index % 4) + 1}`}
                  >
                    {index === 0 ? (
                      <CheckSquare size={14} />
                    ) : index === 1 ? (
                      <Users size={14} />
                    ) : index === 2 ? (
                      <FolderKanban size={14} />
                    ) : (
                      <Activity size={14} />
                    )}
                  </span>

                  <span className="td-activity-copy">
                    <strong>{getNotificationTitle(notification)}</strong>

                    <small>{getNotificationMessage(notification)}</small>

                    <span className="td-activity-time">
                      <Clock3 size={10} />

                      {formatRelativeTime(
                        notification.created_at || notification.createdAt,
                      )}
                    </span>
                  </span>

                  <ChevronRight size={13} className="td-activity-chevron" />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="td-panel-bottom-link"
            onClick={() => navigate("/notifications")}
          >
            View all activity
            <ArrowRight size={14} />
          </button>
        </article>

        {/* ====================================================
            QUICK ACTIONS
        ==================================================== */}

        <article className="td-panel td-quick-actions-panel">
          <div className="td-panel-heading">
            <div>
              <span className="td-panel-eyebrow">TEAM OPERATIONS</span>

              <h2>Quick Actions</h2>

              <p>Get straight to your team's work.</p>
            </div>

            <span className="td-panel-icon">
              <Sparkles size={16} />
            </span>
          </div>

          <div className="td-quick-actions-grid">
            <button
              type="button"
              className="td-quick-action"
              onClick={handleCreateTask}
            >
              <span className="td-quick-action-icon td-action-cyan">
                <Plus size={18} />
              </span>

              <span className="td-quick-action-copy">
                <strong>Create Task</strong>

                <small>Start a piece of work</small>
              </span>

              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="td-quick-action"
              onClick={() => navigate("/projects")}
            >
              <span className="td-quick-action-icon td-action-blue">
                <FolderKanban size={18} />
              </span>

              <span className="td-quick-action-copy">
                <strong>View Projects</strong>

                <small>Track delivery progress</small>
              </span>

              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="td-quick-action"
              onClick={() => navigate("/teams")}
            >
              <span className="td-quick-action-icon td-action-violet">
                <Users size={18} />
              </span>

              <span className="td-quick-action-copy">
                <strong>View Team</strong>

                <small>Review team membership</small>
              </span>

              <ChevronRight size={14} />
            </button>

            <button
              type="button"
              className="td-quick-action"
              onClick={() => navigate("/notifications")}
            >
              <span className="td-quick-action-icon td-action-mint">
                <Bell size={18} />
              </span>

              <span className="td-quick-action-copy">
                <strong>Notifications</strong>

                <small>Review latest updates</small>
              </span>

              <ChevronRight size={14} />
            </button>
          </div>
        </article>

        {/* ====================================================
            WORKSPACE FOOTER PANEL
        ==================================================== */}

        <article className="td-panel td-workspace-panel">
          <div className="td-workspace-icon">
            <Target size={20} />
          </div>

          <div className="td-workspace-copy">
            <span className="td-panel-eyebrow">CURRENT WORKSPACE</span>

            <h2>
              {workspaceName || activeWorkspace?.name || "Company Workspace"}
            </h2>

            <p>
              {workspaceRole || "TEAM_LEADER"} · {teamMembers.length} team
              members · {projectSummaries.length} projects
            </p>
          </div>

          <button
            type="button"
            className="td-workspace-button"
            onClick={() => navigate("/profile")}
          >
            My Profile
            <ArrowRight size={14} />
          </button>
        </article>
      </section>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="td-dashboard-footer">
        <span>
          <strong>ZYRA</strong>
          <i>/</i>
          TEAM INTELLIGENCE
        </span>

        <span>
          <i className="td-footer-status-dot" />
          COMPANY TEAM LEADER
        </span>
      </footer>
    </main>
  );
}

export default TeamDash;
