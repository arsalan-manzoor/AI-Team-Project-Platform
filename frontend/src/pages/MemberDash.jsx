import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock3,
  FolderKanban,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";
import { apiRequest } from "../services/api";

import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/MemberDash.css";

/* ============================================================
   CONSTANTS
============================================================ */

const COMPLETED_STATUSES = new Set(["completed", "complete", "done"]);

const ACTIVE_STATUSES = new Set(["in_progress", "active", "working", "doing"]);

const BLOCKED_STATUSES = new Set(["blocked", "on_hold"]);

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

  if (Array.isArray(value?.tasks)) {
    return value.tasks;
  }

  if (Array.isArray(value?.teams)) {
    return value.teams;
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
  return item?.id ?? item?.project_id ?? item?.task_id ?? item?.team_id;
}

function getTaskId(task) {
  return task?.id ?? task?.task_id;
}

function getProjectId(task) {
  return task?.project_id ?? task?.projectId;
}

function getMemberId(member) {
  return member?.user_id ?? member?.userId ?? member?.member_id ?? member?.id;
}

function getAssigneeId(task) {
  return (
    task?.assigned_to ??
    task?.assignedTo ??
    task?.assignee_id ??
    task?.assigneeId
  );
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

function getStatusLabel(task) {
  const status = normalizeStatus(task?.status);

  if (COMPLETED_STATUSES.has(status)) {
    return "Completed";
  }

  if (ACTIVE_STATUSES.has(status)) {
    return "In Progress";
  }

  if (BLOCKED_STATUSES.has(status)) {
    return "Blocked";
  }

  if (["todo", "pending", "to_do"].includes(status)) {
    return "To Do";
  }

  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
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

function getTaskDescription(task) {
  return task?.description || "";
}

function getDueDate(task) {
  const value =
    task?.due_date ?? task?.deadline ?? task?.dueDate ?? task?.due_at;

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

  const endOfDueDay = new Date(dueDate);

  endOfDueDay.setHours(23, 59, 59, 999);

  return endOfDueDay.getTime() < Date.now();
}

function formatDueDate(task, includeTime = false) {
  const dueDate = getDueDate(task);

  if (!dueDate) {
    return "No due date";
  }

  const today = new Date();

  const isToday =
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate();

  const tomorrow = new Date(today);

  tomorrow.setDate(tomorrow.getDate() + 1);

  const isTomorrow =
    dueDate.getFullYear() === tomorrow.getFullYear() &&
    dueDate.getMonth() === tomorrow.getMonth() &&
    dueDate.getDate() === tomorrow.getDate();

  let label = isToday
    ? "Today"
    : isTomorrow
      ? "Tomorrow"
      : dueDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });

  const rawValue =
    task?.due_date ?? task?.deadline ?? task?.dueDate ?? task?.due_at;

  const containsTime =
    typeof rawValue === "string" && /T\d{2}:\d{2}/.test(rawValue);

  if (includeTime && containsTime) {
    label += `, ${dueDate.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  return label;
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

function sortTasks(tasks) {
  return [...tasks].sort((first, second) => {
    const overdueDifference =
      Number(isOverdue(second)) - Number(isOverdue(first));

    if (overdueDifference !== 0) {
      return overdueDifference;
    }

    const priorityDifference =
      PRIORITY_ORDER[getPriority(first)] - PRIORITY_ORDER[getPriority(second)];

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    const firstDue = getDueDate(first)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    const secondDue = getDueDate(second)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    return firstDue - secondDue;
  });
}

/* ============================================================
   COMPANY MEMBER DASHBOARD
============================================================ */

function MemberDash() {
  const navigate = useNavigate();

  const {
    activeWorkspace,
    workspaceId,
    workspaceName,
    loading: workspaceLoading,
  } = useWorkspace();

  /* ==========================================================
     STATE
  ========================================================== */

  const [user, setUser] = useState(null);

  const [projects, setProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  /* ==========================================================
     LOAD WORKSPACE DATA

     Displays tasks assigned to the signed-in user.

     Projects are limited to those associated with the user's
     assigned tasks or teams.

     Does not modify backend, database, routes, or permissions.
  ========================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (workspaceLoading) {
        return;
      }

      if (!workspaceId) {
        setUser(null);
        setProjects([]);
        setMyTasks([]);
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

      if (userResult.status !== "fulfilled") {
        setUser(null);
        setProjects([]);
        setMyTasks([]);
        setTeamMembers([]);
        setNotifications([]);

        setError(
          userResult.reason?.message ||
            "Unable to load your account. Refresh to try again.",
        );

        setLoading(false);

        return;
      }

      const currentUser = userResult.value;

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
       * STEP 1:
       * Find teams belonging to the active workspace.
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
       * STEP 2:
       * Scope projects to this workspace.
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
       * STEP 3:
       * Scope tasks to projects in this workspace.
       */

      const workspaceTasks = allTasks.filter((task) =>
        workspaceProjectIds.has(Number(getProjectId(task))),
      );

      /*
       * STEP 4:
       * Only show work assigned to the signed-in member.
       */

      const assignedTasks = sortTasks(
        workspaceTasks.filter((task) => {
          const assigneeId = getAssigneeId(task);

          return (
            assigneeId !== undefined &&
            assigneeId !== null &&
            Number(assigneeId) === Number(currentUser.id)
          );
        }),
      );

      /*
       * STEP 5:
       * Find teams in which this user is a member.
       *
       * The colleague panel will be based on actual team
       * membership, not every user in the company.
       */

      const teamMemberResults = await Promise.allSettled(
        workspaceTeams.map((team) => getTeamMembers(getId(team))),
      );

      if (cancelled) {
        return;
      }

      let teamMembershipFailed = false;

      const collectedMemberships = [];

      teamMemberResults.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          teamMembershipFailed = true;
          return;
        }

        const team = workspaceTeams[index];

        const members = getArray(result.value, "members");

        members.forEach((member) => {
          const memberId = getMemberId(member);

          if (memberId === undefined || memberId === null) {
            return;
          }

          collectedMemberships.push({
            ...member,
            displayMemberId: memberId,

            teamId: getId(team),

            teamName: team.name || "Workspace team",
          });
        });
      });

      const myTeamIds = new Set(
        collectedMemberships
          .filter(
            (member) =>
              Number(member.displayMemberId) === Number(currentUser.id),
          )
          .map((member) => Number(member.teamId)),
      );

      /*
       * Keep colleagues to teams the current user belongs to.
       * Merge duplicate members who share multiple teams.
       */

      const colleagueMap = new Map();

      collectedMemberships
        .filter((member) => myTeamIds.has(Number(member.teamId)))
        .forEach((member) => {
          const memberId = String(member.displayMemberId);

          if (memberId === String(currentUser.id)) {
            return;
          }

          if (!colleagueMap.has(memberId)) {
            colleagueMap.set(memberId, {
              ...member,
              teamNames: [],
              teamIds: [],
            });
          }

          const existing = colleagueMap.get(memberId);

          if (
            member.teamName &&
            !existing.teamNames.includes(member.teamName)
          ) {
            existing.teamNames.push(member.teamName);
          }

          if (
            member.teamId !== undefined &&
            member.teamId !== null &&
            !existing.teamIds.includes(Number(member.teamId))
          ) {
            existing.teamIds.push(Number(member.teamId));
          }
        });

      const colleagues = Array.from(colleagueMap.values());

      /*
       * STEP 6:
       * Only show projects associated with the user's tasks
       * or their actual team membership.
       */

      const myProjectIds = new Set(
        assignedTasks
          .map((task) => getProjectId(task))
          .filter((projectId) => projectId !== undefined && projectId !== null)
          .map(Number),
      );

      const myProjects = workspaceProjects.filter(
        (project) =>
          myProjectIds.has(Number(getId(project))) ||
          myTeamIds.has(Number(project.team_id)),
      );

      /*
       * STEP 7:
       * Sort notifications newest first.
       */

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
      setProjects(myProjects);
      setMyTasks(assignedTasks);
      setTeamMembers(colleagues);
      setNotifications(sortedNotifications);

      const essentialRequestFailed =
        projectsResult.status !== "fulfilled" ||
        teamsResult.status !== "fulfilled" ||
        tasksResult.status !== "fulfilled";

      if (essentialRequestFailed) {
        setError(
          "Some workspace information could not be loaded. Refresh to try again.",
        );
      } else if (teamMembershipFailed) {
        setError(
          "Some team information could not be loaded. Your assigned tasks remain available where data was retrieved.",
        );
      } else if (notificationsResult.status !== "fulfilled") {
        setError(
          "Your task information loaded, but notifications could not be retrieved.",
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
     PERSONAL TASK METRICS
  ========================================================== */

  const completedTasks = useMemo(() => myTasks.filter(isCompleted), [myTasks]);

  const pendingTasks = useMemo(
    () => myTasks.filter((task) => !isCompleted(task) && !isBlocked(task)),
    [myTasks],
  );

  const activeTasks = useMemo(() => myTasks.filter(isActive), [myTasks]);

  const overdueTasks = useMemo(() => myTasks.filter(isOverdue), [myTasks]);

  const blockedTasks = useMemo(() => myTasks.filter(isBlocked), [myTasks]);

  const completionRate = myTasks.length
    ? Math.round((completedTasks.length / myTasks.length) * 100)
    : 0;

  /* ==========================================================
     SEARCH
  ========================================================== */

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTasks = useMemo(
    () =>
      myTasks.filter((task) => {
        const project = projects.find(
          (item) => Number(getId(item)) === Number(getProjectId(task)),
        );

        const searchable = [
          getTaskTitle(task),
          getTaskDescription(task),
          task.status,
          task.priority,
          project?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      }),
    [myTasks, projects, normalizedQuery],
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const projectTasks = myTasks.filter(
          (task) => Number(getProjectId(task)) === Number(getId(project)),
        );

        const searchable = [
          project.name,
          project.description,
          project.status,
          ...projectTasks.map(getTaskTitle),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      }),
    [projects, myTasks, normalizedQuery],
  );

  const filteredColleagues = useMemo(
    () =>
      teamMembers.filter((member) => {
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
    [teamMembers, normalizedQuery],
  );

  /* ==========================================================
     TASK PRIORITIES
  ========================================================== */

  const nextPriority = useMemo(
    () =>
      filteredTasks.find((task) => !isCompleted(task) && !isBlocked(task)) ||
      null,
    [filteredTasks],
  );

  const todayTasks = useMemo(
    () =>
      filteredTasks
        .filter((task) => {
          if (isCompleted(task) || isBlocked(task)) {
            return false;
          }

          const dueDate = getDueDate(task);

          if (!dueDate) {
            return false;
          }

          const today = new Date();

          return (
            dueDate.getFullYear() === today.getFullYear() &&
            dueDate.getMonth() === today.getMonth() &&
            dueDate.getDate() === today.getDate()
          );
        })
        .slice(0, 4),
    [filteredTasks],
  );

  const upcomingTasks = useMemo(
    () =>
      filteredTasks
        .filter(
          (task) => getDueDate(task) && !isCompleted(task) && !isBlocked(task),
        )
        .sort(
          (first, second) =>
            getDueDate(first).getTime() - getDueDate(second).getTime(),
        )
        .slice(0, 4),
    [filteredTasks],
  );

  const focusTasks = useMemo(
    () =>
      sortTasks(
        filteredTasks.filter(
          (task) =>
            !isCompleted(task) &&
            !isBlocked(task) &&
            String(getTaskId(task)) !== String(getTaskId(nextPriority)),
        ),
      ).slice(0, 4),
    [filteredTasks, nextPriority],
  );

  /* ==========================================================
     PROJECT SUMMARIES

     Progress is based on the current user's assignments,
     not the entire company's project tasks.
  ========================================================== */

  const projectCards = useMemo(
    () =>
      filteredProjects
        .map((project) => {
          const projectId = Number(getId(project));

          const projectTasks = myTasks.filter(
            (task) => Number(getProjectId(task)) === projectId,
          );

          const completed = projectTasks.filter(isCompleted).length;

          const nextDueTask = [...projectTasks]
            .filter(
              (task) =>
                getDueDate(task) && !isCompleted(task) && !isBlocked(task),
            )
            .sort(
              (first, second) =>
                getDueDate(first).getTime() - getDueDate(second).getTime(),
            )[0];

          return {
            ...project,

            displayId: getId(project),

            taskCount: projectTasks.length,

            completedCount: completed,

            progress: projectTasks.length
              ? Math.round((completed / projectTasks.length) * 100)
              : 0,

            dueText: nextDueTask
              ? formatDueDate(nextDueTask)
              : "No upcoming deadline",
          };
        })
        .sort((first, second) => {
          return (
            Number(first.progress === 100) - Number(second.progress === 100)
          );
        }),
    [filteredProjects, myTasks],
  );

  /* ==========================================================
     RECENT ACTIVITY AND NOTIFICATIONS
  ========================================================== */

  const recentNotifications = notifications.slice(0, 4);

  const unreadCount = notifications.filter(
    (notification) =>
      notification.is_read === false || notification.is_read === 0,
  ).length;

  /* ==========================================================
     PERSONALIZED DISPLAY VALUES
  ========================================================== */

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
     INTERACTIONS
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

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (workspaceLoading || loading) {
    return (
      <main className="md-dashboard">
        <section className="md-loading-panel">
          <div className="md-loading-orb">
            <Sparkles size={24} />
          </div>

          <span className="md-eyebrow">ZYRA / FOCUS WORKSPACE</span>

          <h1>Preparing your workspace</h1>

          <p>
            Connecting your assigned tasks, projects, team, and recent updates.
          </p>

          <div className="md-loading-track">
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
    <main className="md-dashboard">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="md-page-header">
        <div className="md-header-copy">
          <div className="md-header-eyebrow">
            <span className="md-eyebrow">YOUR WORKSPACE</span>

            <span className="md-eyebrow-divider" />

            <span className="md-date-label">{todayLabel}</span>
          </div>

          <h1>My Focus Workspace</h1>

          <p>
            {greeting}, {user?.name?.split(" ")[0] || "there"}. Let's make today
            count.
          </p>
        </div>

        <div className="md-header-actions">
          <label className="md-search-box">
            <Search size={15} />

            <input
              type="search"
              aria-label="Search my tasks and projects"
              placeholder="Search my work..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setQuery("");
                }

                if (event.key === "Enter" && nextPriority) {
                  openTask(nextPriority);
                }
              }}
            />

            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </label>

          <button
            type="button"
            className="md-header-icon-button"
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
            onClick={refreshDashboard}
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="md-header-icon-button md-notification-button"
            title="Notifications"
            aria-label="Open notifications"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={16} />

            {unreadCount > 0 && <span className="md-notification-dot" />}
          </button>

          <button
            type="button"
            className="md-profile-avatar"
            title="Open profile"
            aria-label="Open profile"
            onClick={() => navigate("/profile")}
          >
            {getInitials(user?.name || user?.email)}
          </button>
        </div>
      </header>

      {/* ======================================================
          ERROR / PARTIAL DATA WARNING
      ====================================================== */}

      {error && (
        <div className="md-warning-banner" role="status">
          <Activity size={16} />

          <span>{error}</span>

          <button type="button" onClick={refreshDashboard}>
            Retry
          </button>
        </div>
      )}

      {/* ======================================================
          BENTO GRID
      ====================================================== */}

      <section className="md-bento-grid" aria-label="Personal work dashboard">
        {/* ====================================================
            WELCOME PANEL
        ==================================================== */}

        <article className="md-welcome-panel">
          <div className="md-welcome-glow" />
          <div className="md-welcome-waves" />
          <div className="md-welcome-grid" />

          <div className="md-welcome-content">
            <span className="md-welcome-eyebrow">
              <Sparkles size={13} />
              YOUR PERSONAL WORKSPACE
            </span>

            <h2>
              Make today
              <br />
              <span>count.</span>
            </h2>

            <p>
              Stay focused on your assignments, keep projects moving, and make
              meaningful progress.
            </p>

            <div className="md-workspace-chip">
              <span>
                <Layers size={13} />
              </span>

              <strong>
                {workspaceName || activeWorkspace?.name || "Company Workspace"}
              </strong>
            </div>

            <button
              type="button"
              className="md-welcome-button"
              onClick={() => navigate("/tasks")}
            >
              Open My Tasks
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="md-welcome-art" aria-hidden="true">
            <div className="md-art-orbit md-art-orbit-one" />

            <div className="md-art-orbit md-art-orbit-two" />

            <div className="md-art-orbit md-art-orbit-three" />

            <div className="md-art-core">
              <Target size={28} />
            </div>

            <span className="md-art-node md-art-node-one">
              <CheckSquare size={14} />
            </span>

            <span className="md-art-node md-art-node-two">
              <Sparkles size={14} />
            </span>

            <span className="md-art-node md-art-node-three">
              <Activity size={14} />
            </span>
          </div>
        </article>

        {/* ====================================================
            MY TASKS METRIC
        ==================================================== */}

        <button
          type="button"
          className="md-metric-card md-metric-tasks"
          onClick={() => navigate("/tasks")}
        >
          <span className="md-metric-topline">
            <span>My Tasks</span>

            <span className="md-metric-icon">
              <CheckSquare size={17} />
            </span>
          </span>

          <strong className="md-metric-value">{myTasks.length}</strong>

          <span className="md-metric-caption">
            Total assigned work
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            IN PROGRESS METRIC
        ==================================================== */}

        <button
          type="button"
          className="md-metric-card md-metric-active"
          onClick={() => navigate("/tasks")}
        >
          <span className="md-metric-topline">
            <span>In Progress</span>

            <span className="md-metric-icon">
              <Activity size={17} />
            </span>
          </span>

          <strong className="md-metric-value">{activeTasks.length}</strong>

          <span className="md-metric-caption">
            Work underway
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            COMPLETED METRIC
        ==================================================== */}

        <button
          type="button"
          className="md-metric-card md-metric-completed"
          onClick={() => navigate("/tasks")}
        >
          <span className="md-metric-topline">
            <span>Completed</span>

            <span className="md-metric-icon">
              <CheckCircle2 size={17} />
            </span>
          </span>

          <strong className="md-metric-value">{completedTasks.length}</strong>

          <span className="md-metric-caption">
            Finished assignments
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            OVERDUE METRIC
        ==================================================== */}

        <button
          type="button"
          className="md-metric-card md-metric-overdue"
          onClick={() => navigate("/tasks")}
        >
          <span className="md-metric-topline">
            <span>Overdue</span>

            <span className="md-metric-icon">
              <Clock3 size={17} />
            </span>
          </span>

          <strong className="md-metric-value">{overdueTasks.length}</strong>

          <span className="md-metric-caption">
            Past their due date
            <ArrowRight size={12} />
          </span>
        </button>

        {/* ====================================================
            NEXT PRIORITY
        ==================================================== */}

        <article className="md-panel md-priority-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">YOUR NEXT PRIORITY</span>

              <h2>Focus on what matters</h2>

              <p>Your highest-priority incomplete assignment.</p>
            </div>

            <span className="md-panel-icon">
              <Target size={16} />
            </span>
          </div>

          {nextPriority ? (
            <div className="md-priority-content">
              <div className="md-priority-task-heading">
                <span
                  className={`md-priority-marker md-priority-marker-${getPriority(nextPriority)}`}
                />

                <span className="md-priority-task-title">
                  {getTaskTitle(nextPriority)}
                </span>
              </div>

              {getTaskDescription(nextPriority) && (
                <p className="md-priority-description">
                  {getTaskDescription(nextPriority)}
                </p>
              )}

              <div className="md-priority-meta">
                <span
                  className={`md-priority-badge md-priority-badge-${getPriority(nextPriority)}`}
                >
                  {getPriorityLabel(nextPriority)} priority
                </span>

                <span
                  className={`md-due-badge ${
                    isOverdue(nextPriority) ? "md-due-overdue" : ""
                  }`}
                >
                  <Clock3 size={11} />

                  {formatDueDate(nextPriority, true)}
                </span>
              </div>

              <button
                type="button"
                className="md-primary-button"
                onClick={() => openTask(nextPriority)}
              >
                Open Task
                <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="md-priority-empty">
              <CheckCircle2 size={24} />

              <strong>
                {query ? "No matching priority tasks" : "You're all caught up"}
              </strong>

              <p>
                {query
                  ? "Try another search term."
                  : "New assignments will appear here when work is assigned to you."}
              </p>

              {query && (
                <button
                  type="button"
                  className="md-inline-link"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </article>

        {/* ====================================================
            PROJECT INTELLIGENCE
        ==================================================== */}

        <article className="md-panel md-projects-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">YOUR PROJECTS</span>

              <h2>Project Intelligence</h2>

              <p>Projects connected to your assignments.</p>
            </div>

            <button
              type="button"
              className="md-heading-action"
              onClick={() => navigate("/projects")}
            >
              View all
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="md-project-summary">
            <div className="md-project-summary-ring">
              <div>
                <strong>{completionRate}%</strong>

                <span>MY PROGRESS</span>
              </div>
            </div>

            <div className="md-project-summary-copy">
              <strong>Your task completion</strong>

              <span>
                {completedTasks.length} of {myTasks.length} assigned tasks
                complete
              </span>

              <div className="md-project-summary-track">
                <span
                  style={{
                    width: `${completionRate}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="md-project-list">
            {projectCards.length === 0 ? (
              <div className="md-empty-state">
                <FolderKanban size={22} />

                <strong>
                  {query
                    ? "No matching projects"
                    : "Your projects will appear here"}
                </strong>

                <p>
                  {query
                    ? "Try a different search term."
                    : "Projects associated with your tasks or team membership will appear here."}
                </p>

                {!query && (
                  <button
                    type="button"
                    className="md-inline-link"
                    onClick={() => navigate("/projects")}
                  >
                    Explore Projects
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            ) : (
              projectCards.slice(0, 4).map((project, index) => (
                <button
                  type="button"
                  className="md-project-row"
                  key={project.displayId}
                  onClick={() => openProject(project)}
                >
                  <span
                    className={`md-project-icon md-project-icon-${(index % 4) + 1}`}
                  >
                    <FolderKanban size={15} />
                  </span>

                  <span className="md-project-copy">
                    <strong>{project.name || "Untitled project"}</strong>

                    <small>
                      {project.completedCount}/{project.taskCount} of your tasks
                      complete
                    </small>

                    <span className="md-project-row-track">
                      <span
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </span>
                  </span>

                  <span className="md-project-row-percent">
                    {project.progress}%
                    <ChevronRight size={12} />
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="md-panel-bottom-link"
            onClick={() => navigate("/projects")}
          >
            Explore my projects
            <ArrowRight size={13} />
          </button>
        </article>

        {/* ====================================================
            TODAY'S FOCUS
        ==================================================== */}

        <article className="md-panel md-today-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">STAY ON TRACK</span>

              <h2>Today's Focus</h2>

              <p>Work worth prioritizing today.</p>
            </div>

            <span className="md-panel-icon">
              <Target size={16} />
            </span>
          </div>

          <div className="md-today-list">
            {todayTasks.length === 0 ? (
              <div className="md-today-empty">
                <CalendarClock size={21} />

                <strong>No tasks due today</strong>

                <p>Tasks with today's due date will appear here.</p>
              </div>
            ) : (
              todayTasks.map((task, index) => (
                <button
                  type="button"
                  className="md-today-task"
                  key={getTaskId(task)}
                  onClick={() => openTask(task)}
                >
                  <span
                    className={`md-today-task-marker md-today-marker-${getPriority(task)}`}
                  />

                  <span className="md-today-task-copy">
                    <strong>{getTaskTitle(task)}</strong>

                    <small>{getPriorityLabel(task)} priority</small>
                  </span>

                  <ChevronRight size={13} />
                </button>
              ))
            )}
          </div>

          <div className="md-upcoming-heading">
            <span>Upcoming deadlines</span>

            <CalendarClock size={14} />
          </div>

          <div className="md-upcoming-list">
            {upcomingTasks.length === 0 ? (
              <p className="md-upcoming-empty">
                No upcoming dated tasks are available.
              </p>
            ) : (
              upcomingTasks.slice(0, 3).map((task) => (
                <button
                  type="button"
                  className="md-upcoming-row"
                  key={getTaskId(task)}
                  onClick={() => openTask(task)}
                >
                  <span
                    className={`md-upcoming-date ${
                      isOverdue(task) ? "md-upcoming-date-overdue" : ""
                    }`}
                  >
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
            className="md-panel-bottom-link"
            onClick={() => navigate("/tasks")}
          >
            Open my task list
            <ArrowRight size={13} />
          </button>
        </article>

        {/* ====================================================
            MY ASSIGNED TASKS
        ==================================================== */}

        <article className="md-panel md-tasks-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">PERSONAL EXECUTION</span>

              <h2>My Assigned Tasks</h2>

              <p>Your work, ordered by urgency and priority.</p>
            </div>

            <button
              type="button"
              className="md-heading-action"
              onClick={() => navigate("/tasks")}
            >
              All tasks
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="md-task-toolbar">
            <div className="md-task-count">
              <CheckSquare size={15} />

              <strong>{filteredTasks.length}</strong>

              <span>assignments</span>
            </div>

            <span className="md-task-completion-chip">
              <CheckCircle2 size={12} />
              {completionRate}% complete
            </span>
          </div>

          <div className="md-task-list">
            {filteredTasks.length === 0 ? (
              <div className="md-empty-state md-task-empty">
                <CheckSquare size={23} />

                <strong>
                  {query ? "No matching tasks" : "No assigned tasks yet"}
                </strong>

                <p>
                  {query
                    ? "Try searching with another task or project name."
                    : "Tasks assigned to your account will appear here."}
                </p>

                {query && (
                  <button
                    type="button"
                    className="md-inline-link"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              sortTasks(filteredTasks)
                .slice(0, 7)
                .map((task, index) => {
                  const project = projects.find(
                    (item) =>
                      Number(getId(item)) === Number(getProjectId(task)),
                  );

                  const completed = isCompleted(task);
                  const blocked = isBlocked(task);
                  const overdue = isOverdue(task);
                  const priority = getPriority(task);

                  return (
                    <button
                      type="button"
                      className="md-task-row"
                      key={getTaskId(task)}
                      onClick={() => openTask(task)}
                    >
                      <span
                        className={`md-task-checkbox ${
                          completed ? "md-task-checkbox-complete" : ""
                        }`}
                        aria-hidden="true"
                      >
                        {completed && <CheckCircle2 size={15} />}
                      </span>

                      <span className="md-task-row-copy">
                        <strong
                          className={completed ? "md-task-title-complete" : ""}
                        >
                          {getTaskTitle(task)}
                        </strong>

                        <small>{project?.name || "Assigned project"}</small>

                        <span className="md-task-row-meta">
                          <span
                            className={`md-task-status md-task-status-${normalizeStatus(task.status)}`}
                          >
                            {getStatusLabel(task)}
                          </span>

                          <span
                            className={`md-task-priority md-task-priority-${priority}`}
                          >
                            {priority}
                          </span>

                          {overdue && (
                            <span className="md-task-overdue-label">
                              Overdue
                            </span>
                          )}

                          {blocked && (
                            <span className="md-task-blocked-label">
                              Blocked
                            </span>
                          )}
                        </span>
                      </span>

                      <span
                        className={`md-task-due ${
                          overdue ? "md-task-due-overdue" : ""
                        }`}
                      >
                        <Clock3 size={11} />

                        {formatDueDate(task)}
                      </span>

                      <ChevronRight size={13} className="md-task-chevron" />
                    </button>
                  );
                })
            )}
          </div>

          {filteredTasks.length > 7 && (
            <div className="md-task-footer-note">
              Showing 7 of {filteredTasks.length} assigned tasks.
            </div>
          )}

          <button
            type="button"
            className="md-panel-bottom-link"
            onClick={() => navigate("/tasks")}
          >
            View all assigned tasks
            <ArrowRight size={13} />
          </button>
        </article>

        {/* ====================================================
            TEAM COLLABORATION
        ==================================================== */}

        <article className="md-panel md-team-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">WORKING TOGETHER</span>

              <h2>My Team</h2>

              <p>Colleagues who share your team membership.</p>
            </div>

            <span className="md-panel-icon">
              <Users size={16} />
            </span>
          </div>

          <div className="md-team-overview">
            <div className="md-team-overview-icon">
              <Users size={18} />
            </div>

            <div>
              <strong>{teamMembers.length}</strong>

              <span>
                {teamMembers.length === 1
                  ? "Team colleague"
                  : "Team colleagues"}
              </span>
            </div>
          </div>

          <div className="md-team-list">
            {filteredColleagues.length === 0 ? (
              <div className="md-team-empty">
                <UserRound size={21} />

                <strong>
                  {query
                    ? "No matching colleagues"
                    : "Your team will appear here"}
                </strong>

                <p>
                  {query
                    ? "Try another search term."
                    : "Colleagues sharing your team membership will appear here when available."}
                </p>

                {query && (
                  <button
                    type="button"
                    className="md-inline-link"
                    onClick={() => setQuery("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredColleagues.slice(0, 5).map((member, index) => (
                <div className="md-team-member" key={member.displayMemberId}>
                  <span
                    className={`md-team-avatar md-team-avatar-${(index % 4) + 1}`}
                  >
                    {getInitials(getMemberName(member))}
                  </span>

                  <span className="md-team-member-copy">
                    <strong>{getMemberName(member)}</strong>

                    <small>
                      {(member.teamNames || []).join(", ") || "Team colleague"}
                    </small>
                  </span>

                  <span className="md-team-member-indicator">
                    <span />
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            className="md-panel-bottom-link"
            onClick={() => navigate("/teams")}
          >
            Explore teams
            <ArrowRight size={13} />
          </button>
        </article>

        {/* ====================================================
            RECENT ACTIVITY
        ==================================================== */}

        <article className="md-panel md-activity-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">WORKSPACE UPDATES</span>

              <h2>Recent Activity</h2>

              <p>Your latest workspace notifications.</p>
            </div>

            <span className="md-panel-icon">
              <Activity size={16} />
            </span>
          </div>

          <div className="md-activity-list">
            {recentNotifications.length === 0 ? (
              <div className="md-activity-empty">
                <Bell size={22} />

                <strong>No recent updates</strong>

                <p>
                  New notifications will appear here when they are available.
                </p>
              </div>
            ) : (
              recentNotifications.map((notification, index) => (
                <button
                  type="button"
                  className="md-activity-row"
                  key={notification.id ?? `${notification.title}-${index}`}
                  onClick={() => navigate("/notifications")}
                >
                  <span
                    className={`md-activity-icon md-activity-icon-${(index % 4) + 1}`}
                  >
                    {index === 0 ? (
                      <Activity size={14} />
                    ) : index === 1 ? (
                      <CheckSquare size={14} />
                    ) : index === 2 ? (
                      <FolderKanban size={14} />
                    ) : (
                      <Bell size={14} />
                    )}
                  </span>

                  <span className="md-activity-copy">
                    <strong>{notification.title || "Workspace update"}</strong>

                    <small>
                      {notification.message ||
                        "A new workspace notification is available."}
                    </small>

                    <span className="md-activity-time">
                      <Clock3 size={10} />

                      {formatRelativeTime(
                        notification.created_at || notification.createdAt,
                      )}
                    </span>
                  </span>

                  <ChevronRight size={13} className="md-activity-chevron" />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="md-panel-bottom-link"
            onClick={() => navigate("/notifications")}
          >
            View all notifications
            <ArrowRight size={13} />
          </button>
        </article>

        {/* ====================================================
            QUICK ACTIONS
        ==================================================== */}

        <article className="md-panel md-quick-actions-panel">
          <div className="md-panel-heading">
            <div>
              <span className="md-panel-eyebrow">YOUR WORKSPACE</span>

              <h2>Quick Access</h2>

              <p>Jump straight to what you need.</p>
            </div>

            <span className="md-panel-icon">
              <Sparkles size={16} />
            </span>
          </div>

          <div className="md-quick-actions-grid">
            <button
              type="button"
              className="md-quick-action"
              onClick={() => navigate("/tasks")}
            >
              <span className="md-quick-icon md-quick-cyan">
                <CheckSquare size={17} />
              </span>

              <span className="md-quick-copy">
                <strong>My Tasks</strong>

                <small>Review assignments</small>
              </span>

              <ChevronRight size={13} />
            </button>

            <button
              type="button"
              className="md-quick-action"
              onClick={() => navigate("/projects")}
            >
              <span className="md-quick-icon md-quick-blue">
                <FolderKanban size={17} />
              </span>

              <span className="md-quick-copy">
                <strong>My Projects</strong>

                <small>Track project progress</small>
              </span>

              <ChevronRight size={13} />
            </button>

            <button
              type="button"
              className="md-quick-action"
              onClick={() => navigate("/notifications")}
            >
              <span className="md-quick-icon md-quick-violet">
                <Bell size={17} />
              </span>

              <span className="md-quick-copy">
                <strong>Notifications</strong>

                <small>Read workspace updates</small>
              </span>

              <ChevronRight size={13} />
            </button>

            <button
              type="button"
              className="md-quick-action"
              onClick={() => navigate("/profile")}
            >
              <span className="md-quick-icon md-quick-mint">
                <UserRound size={17} />
              </span>

              <span className="md-quick-copy">
                <strong>My Profile</strong>

                <small>Review account details</small>
              </span>

              <ChevronRight size={13} />
            </button>
          </div>
        </article>

        {/* ====================================================
            WORKSPACE SUMMARY
        ==================================================== */}

        <article className="md-panel md-workspace-panel">
          <div className="md-workspace-icon">
            <Layers size={19} />
          </div>

          <div className="md-workspace-copy">
            <span className="md-panel-eyebrow">CURRENT WORKSPACE</span>

            <h2>
              {workspaceName || activeWorkspace?.name || "Company Workspace"}
            </h2>

            <p>
              {myTasks.length} assigned tasks · {projects.length} accessible
              projects · Personal workspace overview
            </p>
          </div>

          <button
            type="button"
            className="md-workspace-button"
            onClick={() => navigate("/profile")}
          >
            My Profile
            <ArrowRight size={13} />
          </button>
        </article>
      </section>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="md-dashboard-footer">
        <span>
          <strong>ZYRA</strong>
          <i>/</i>
          FOCUS WORKSPACE
        </span>

        <span>
          <i className="md-footer-status-dot" />
          COMPANY MEMBER
        </span>
      </footer>
    </main>
  );
}

export default MemberDash;
