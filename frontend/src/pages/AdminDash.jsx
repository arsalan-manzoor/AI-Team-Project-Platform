import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FolderKanban,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams } from "../services/teamService";
import { getTasks } from "../services/taskService";
import { apiRequest } from "../services/api";

import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/AdminDash.css";

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

/* ============================================================
   HELPERS
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
  return (
    item?.id ??
    item?.user_id ??
    item?.project_id ??
    item?.team_id ??
    item?.task_id
  );
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

function formatDate(value) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const now = new Date();
  const difference = Math.max(0, now.getTime() - date.getTime());

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

function getRoleLabel(member) {
  const role = String(
    member?.workspace_role || member?.role || "USER",
  ).toUpperCase();

  const labels = {
    ADMIN: "Administrator",
    HR: "Human Resources",
    TEAM_LEADER: "Team Leader",
    USER: "Member",
  };

  return labels[role] || role.replace(/_/g, " ");
}

function getRoleClass(member) {
  const role = String(
    member?.workspace_role || member?.role || "USER",
  ).toLowerCase();

  return role.replace(/_/g, "-");
}

function getAccountStatus(member) {
  return String(member?.account_status || "Unknown")
    .trim()
    .toLowerCase();
}

/* ============================================================
   COMPANY ADMIN DASHBOARD
============================================================ */

function AdminDash() {
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  /* ==========================================================
     LOAD WORKSPACE DATA
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
        apiRequest(`/workspaces/${workspaceId}/members`),
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
        membersResult,
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

      const workspaceMembers =
        membersResult.status === "fulfilled"
          ? getArray(membersResult.value, "members")
          : [];

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
      setMembers(workspaceMembers);
      setTeams(workspaceTeams);
      setProjects(workspaceProjects);
      setTasks(workspaceTasks);
      setNotifications(sortedNotifications);

      const failedRequests = results.filter(
        (result) => result.status === "rejected",
      );

      if (failedRequests.length > 0) {
        setError(
          "Some dashboard information could not be loaded. Check your connection or refresh the dashboard.",
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

  const completionRate = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;

  const activeProjectCount = useMemo(
    () =>
      projects.filter((project) => {
        const status = normalizeStatus(project.status);

        return !["completed", "complete", "done", "archived"].includes(status);
      }).length,
    [projects],
  );

  const projectSummaries = useMemo(
    () =>
      projects.map((project) => {
        const projectId = Number(getId(project));

        const projectTasks = tasks.filter(
          (task) => Number(task.project_id) === projectId,
        );

        const completed = projectTasks.filter(isCompleted).length;

        const progress = projectTasks.length
          ? Math.round((completed / projectTasks.length) * 100)
          : 0;

        const projectTeam = teams.find(
          (team) => Number(getId(team)) === Number(project.team_id),
        );

        return {
          ...project,
          displayId: getId(project),
          taskCount: projectTasks.length,
          completedCount: completed,
          progress,
          teamName: projectTeam?.name || "Unassigned team",
        };
      }),
    [projects, tasks, teams],
  );

  const teamSummaries = useMemo(
    () =>
      teams.map((team) => {
        const teamId = Number(getId(team));

        const teamProjects = projects.filter(
          (project) => Number(project.team_id) === teamId,
        );

        const teamTasks = tasks.filter((task) =>
          teamProjects.some(
            (project) => Number(getId(project)) === Number(task.project_id),
          ),
        );

        const completed = teamTasks.filter(isCompleted).length;

        const progress = teamTasks.length
          ? Math.round((completed / teamTasks.length) * 100)
          : 0;

        return {
          ...team,
          displayId: getId(team),
          projectCount: teamProjects.length,
          taskCount: teamTasks.length,
          progress,
        };
      }),
    [teams, projects, tasks],
  );

  const roleDistribution = useMemo(() => {
    const counts = {
      ADMIN: 0,
      HR: 0,
      TEAM_LEADER: 0,
      USER: 0,
    };

    members.forEach((member) => {
      const role = String(
        member.workspace_role || member.role || "USER",
      ).toUpperCase();

      if (Object.prototype.hasOwnProperty.call(counts, role)) {
        counts[role] += 1;
      }
    });

    return counts;
  }, [members]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const searchable = [
          member.name,
          member.email,
          member.workspace_role,
          member.role,
          member.account_status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      }),
    [members, normalizedSearch],
  );

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

        return searchable.includes(normalizedSearch);
      }),
    [projectSummaries, normalizedSearch],
  );

  const recentNotifications = notifications.slice(0, 5);

  const unreadCount = notifications.filter(
    (notification) =>
      notification.is_read === false || notification.is_read === 0,
  ).length;

  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const headerDate = new Date().toLocaleDateString("en-IN", {
    month: "short",
    day: "2-digit",
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
     ACTION HELPERS
  ========================================================== */

  function scrollToDirectory() {
    document.getElementById("za-member-directory")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
  }

  function handleCreateTask() {
    if (projects.length === 1) {
      const projectId = getId(projects[0]);

      if (projectId !== undefined && projectId !== null) {
        navigate(`/projects/${projectId}/tasks/create`);
        return;
      }
    }

    if (projects.length === 0) {
      navigate("/projects/create");
      return;
    }

    navigate("/projects");
  }

  /* ==========================================================
     LOADING STATE
  ========================================================== */

  if (workspaceLoading || loading) {
    return (
      <main className="za-dashboard">
        <section className="za-state-panel">
          <div className="za-state-orb">
            <Sparkles size={25} />
          </div>

          <span className="za-eyebrow">ZYRA / BENTO INTELLIGENCE</span>

          <h1>Preparing your workspace</h1>

          <p>Connecting your organization, teams, projects, and activity.</p>

          <div className="za-loading-track">
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
    <main className="za-dashboard">
      {/* ======================================================
          HEADER ACTION STYLES
      ====================================================== */}

      <style>{`
        .za-dashboard .za-header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 9px;
        }

        .za-dashboard .za-header-primary-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 39px;
          padding: 9px 12px;
          color: #07171d;
          background: linear-gradient(100deg, #8cecf1, #54d3df);
          border: 1px solid rgba(100, 216, 223, 0.3);
          border-radius: 10px;
          font: inherit;
          font-size: 11px;
          font-weight: 750;
          white-space: nowrap;
          cursor: pointer;
          transition:
            transform 180ms ease,
            filter 180ms ease;
        }

        .za-dashboard .za-header-primary-action:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .za-dashboard .za-header-primary-action:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .za-dashboard .za-header-date-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 39px;
          padding: 9px 12px;
          color: #aebfd2;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(141, 172, 198, 0.17);
          border-radius: 10px;
          font-size: 11px;
          white-space: nowrap;
        }

        .za-dashboard .za-header-date-chip svg {
          color: #7bdfe8;
        }

        @media (max-width: 1100px) {
          .za-dashboard .za-header-actions {
            justify-content: flex-start;
          }
        }

        @media (max-width: 760px) {
          .za-dashboard .za-header-primary-action {
            flex: 1 1 auto;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .za-dashboard .za-header-primary-action {
            transition: none;
          }
        }
      `}</style>

      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <header className="za-page-header">
        <div className="za-page-heading">
          <div className="za-eyebrow-row">
            <span className="za-eyebrow">COMPANY WORKSPACE</span>

            <span className="za-header-divider" />

            <span className="za-date-label">{currentDate}</span>
          </div>

          <h1>
            {greeting}, <span>{user?.name?.split(" ")[0] || "Admin"}</span>
          </h1>

          <p>
            Your organization, people, and projects — connected in one place.
          </p>
        </div>

        <div className="za-header-actions">
          {/* INVITE EMPLOYEE */}

          <button
            type="button"
            className="za-header-primary-action"
            onClick={() => navigate("/employees")}
            disabled={loading || workspaceLoading}
            title="Open employee management"
          >
            <UserPlus size={16} />
            <span>Invite Employee</span>
          </button>

          {/* CREATE PROJECT */}

          <button
            type="button"
            className="za-header-primary-action"
            onClick={() => navigate("/projects/create")}
            disabled={loading || workspaceLoading}
            title="Create a new project"
          >
            <FolderKanban size={16} />
            <span>Create Project</span>
          </button>

          {/* NEW TASK */}

          <button
            type="button"
            className="za-header-primary-action"
            onClick={handleCreateTask}
            disabled={loading || workspaceLoading}
            title="Create a new task"
          >
            <Plus size={17} />
            <span>New Task</span>
          </button>

          {/* NOTIFICATIONS */}

          <button
            type="button"
            className="za-header-icon-button za-notification-button"
            aria-label="Open notifications"
            title="Notifications"
            onClick={() => navigate("/notifications")}
          >
            <Bell size={17} />

            {unreadCount > 0 && <span className="za-notification-dot" />}
          </button>

          {/* ZYRA AI */}

          <button
            type="button"
            className="za-header-icon-button"
            aria-label="Open AI Assistant"
            title="ZYRA AI Assistant"
            onClick={() => navigate("/ai-assistant")}
          >
            <Sparkles size={17} />
          </button>

          {/* SEARCH */}

          <label className="za-search-box">
            <Search size={16} />

            <input
              type="search"
              placeholder="Search people or projects..."
              aria-label="Search people or projects"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            {searchQuery && (
              <button
                type="button"
                className="za-search-clear"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
              >
                ×
              </button>
            )}
          </label>

          {/* REFRESH */}

          <button
            type="button"
            className="za-header-icon-button"
            aria-label="Refresh dashboard"
            title="Refresh dashboard"
            onClick={handleRefresh}
          >
            <RefreshCw size={16} />
          </button>

          {/* DATE */}

          <div className="za-header-date-chip">
            <CalendarDays size={15} />
            <span>{headerDate}</span>
          </div>

          {/* PROFILE */}

          <button
            type="button"
            className="za-profile-button"
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
        <div className="za-warning-banner" role="status">
          <Activity size={17} />

          <span>{error}</span>

          <button type="button" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* ======================================================
          ORGANIZATION METRICS
      ====================================================== */}

      <section className="za-stats-grid" aria-label="Organization statistics">
        <button
          type="button"
          className="za-stat-card za-stat-people"
          onClick={scrollToDirectory}
        >
          <div className="za-stat-topline">
            <span>Workspace members</span>

            <span className="za-stat-icon">
              <Users size={18} />
            </span>
          </div>

          <div className="za-stat-value">{members.length}</div>

          <div className="za-stat-bottom">
            <span>Organization directory</span>

            <ArrowRight size={14} />
          </div>
        </button>

        <button
          type="button"
          className="za-stat-card za-stat-projects"
          onClick={() => navigate("/projects")}
        >
          <div className="za-stat-topline">
            <span>Active projects</span>

            <span className="za-stat-icon">
              <FolderKanban size={18} />
            </span>
          </div>

          <div className="za-stat-value">{activeProjectCount}</div>

          <div className="za-stat-bottom">
            <span>Project portfolio</span>

            <ArrowRight size={14} />
          </div>
        </button>

        <button
          type="button"
          className="za-stat-card za-stat-teams"
          onClick={() => navigate("/teams")}
        >
          <div className="za-stat-topline">
            <span>Teams</span>

            <span className="za-stat-icon">
              <Layers size={18} />
            </span>
          </div>

          <div className="za-stat-value">{teams.length}</div>

          <div className="za-stat-bottom">
            <span>Organized workspaces</span>

            <ArrowRight size={14} />
          </div>
        </button>

        <button
          type="button"
          className="za-stat-card za-stat-completion"
          onClick={() => navigate("/tasks")}
        >
          <div className="za-stat-topline">
            <span>Task completion</span>

            <span className="za-stat-icon">
              <CheckCircle2 size={18} />
            </span>
          </div>

          <div className="za-stat-value">{completionRate}%</div>

          <div className="za-stat-bottom">
            <span>
              {completedTasks.length} of {tasks.length} tasks
            </span>

            <ArrowRight size={14} />
          </div>
        </button>
      </section>

      {/* ======================================================
          BENTO GRID
      ====================================================== */}

      <section className="za-bento-grid" aria-label="Organization dashboard">
        {/* ORGANIZATION OVERVIEW */}

        <article className="za-panel za-overview-panel">
          <div className="za-overview-glow" />
          <div className="za-overview-grid" />

          <div className="za-overview-content">
            <div className="za-overview-label">
              <span className="za-live-indicator" />
              ORGANIZATION OVERVIEW
            </div>

            <h2>
              Everything connected.
              <br />
              <span>One clear view.</span>
            </h2>

            <p>
              Monitor your organization's people, projects, and progress from
              your administration center.
            </p>

            <div className="za-overview-meta">
              <span className="za-workspace-mark">
                <Briefcase size={15} />
              </span>

              <span>
                {workspaceName || activeWorkspace?.name || "Company Workspace"}
              </span>

              <span className="za-workspace-role">
                {workspaceRole || "ADMIN"}
              </span>
            </div>

            <div className="za-overview-actions">
              <button
                type="button"
                className="za-primary-button"
                onClick={() => navigate("/projects")}
              >
                Explore projects
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                className="za-secondary-button"
                onClick={scrollToDirectory}
              >
                View directory
              </button>
            </div>
          </div>

          <div className="za-overview-visual">
            <div
              className="za-progress-ring"
              style={{
                "--za-progress": `${completionRate}%`,
              }}
              aria-label={`${completionRate}% task completion`}
            >
              <div className="za-progress-ring-inner">
                <Sparkles size={20} />

                <strong>{completionRate}%</strong>

                <span>COMPLETED</span>
              </div>
            </div>

            <div className="za-orbit za-orbit-one" />
            <div className="za-orbit za-orbit-two" />

            <div className="za-floating-node za-node-one">
              <Users size={15} />
            </div>

            <div className="za-floating-node za-node-two">
              <FolderKanban size={15} />
            </div>

            <div className="za-floating-node za-node-three">
              <Activity size={15} />
            </div>
          </div>
        </article>

        {/* QUICK ACTIONS */}

        <article className="za-panel za-actions-panel">
          <div className="za-panel-heading">
            <div>
              <span className="za-panel-eyebrow">GET THINGS DONE</span>

              <h2>Quick actions</h2>

              <p>Jump straight into your next task.</p>
            </div>

            <span className="za-panel-heading-icon">
              <Sparkles size={17} />
            </span>
          </div>

          <div className="za-quick-actions-grid">
            <button
              type="button"
              className="za-quick-action"
              onClick={() => navigate("/projects/create")}
            >
              <span className="za-quick-action-icon za-action-cyan">
                <Plus size={19} />
              </span>

              <span className="za-quick-action-copy">
                <strong>Create project</strong>
                <small>Start something new</small>
              </span>

              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="za-quick-action"
              onClick={() => navigate("/teams/create")}
            >
              <span className="za-quick-action-icon za-action-violet">
                <Users size={19} />
              </span>

              <span className="za-quick-action-copy">
                <strong>Create team</strong>
                <small>Organize your people</small>
              </span>

              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="za-quick-action"
              onClick={scrollToDirectory}
            >
              <span className="za-quick-action-icon za-action-blue">
                <ShieldCheck size={19} />
              </span>

              <span className="za-quick-action-copy">
                <strong>Workspace directory</strong>
                <small>Review members and roles</small>
              </span>

              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              className="za-quick-action"
              onClick={() => navigate("/ai-assistant")}
            >
              <span className="za-quick-action-icon za-action-purple">
                <Sparkles size={19} />
              </span>

              <span className="za-quick-action-copy">
                <strong>ZYRA AI</strong>
                <small>Open your assistant</small>
              </span>

              <ChevronRight size={16} />
            </button>
          </div>

          <div className="za-action-footer">
            <span className="za-action-footer-dot" />
            <span>Manage your workspace without losing focus.</span>
          </div>
        </article>

        {/* PROJECT HEALTH */}

        <article className="za-panel za-projects-panel">
          <div className="za-panel-heading">
            <div>
              <span className="za-panel-eyebrow">PROJECT PORTFOLIO</span>

              <h2>Project health</h2>

              <p>Progress across your active initiatives.</p>
            </div>

            <button
              type="button"
              className="za-text-action"
              onClick={() => navigate("/projects")}
            >
              View all
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="za-project-list">
            {loading ? (
              <div className="za-empty-state">Loading projects...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="za-empty-state">
                <span className="za-empty-icon">
                  <FolderKanban size={23} />
                </span>

                <strong>
                  {searchQuery
                    ? "No matching projects"
                    : "Your project space is ready"}
                </strong>

                <p>
                  {searchQuery
                    ? "Try another search term."
                    : "Projects in this workspace will appear here."}
                </p>

                {!searchQuery && (
                  <button
                    type="button"
                    className="za-inline-action"
                    onClick={() => navigate("/projects/create")}
                  >
                    Create a project
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ) : (
              filteredProjects.slice(0, 5).map((project, index) => (
                <button
                  type="button"
                  className="za-project-row"
                  key={project.displayId}
                  onClick={() => navigate(`/projects/${project.displayId}`)}
                >
                  <span
                    className={`za-project-symbol za-project-symbol-${(index % 4) + 1}`}
                  >
                    <FolderKanban size={17} />
                  </span>

                  <span className="za-project-main">
                    <span className="za-project-title-line">
                      <strong>{project.name || "Untitled project"}</strong>

                      <span className="za-project-progress-label">
                        {project.progress}%
                      </span>
                    </span>

                    <span className="za-project-subtitle">
                      {project.teamName}
                      <span className="za-meta-separator">·</span>
                      {project.completedCount}/{project.taskCount} tasks
                    </span>

                    <span className="za-progress-track">
                      <span
                        style={{
                          width: `${project.progress}%`,
                        }}
                      />
                    </span>
                  </span>

                  <ChevronRight className="za-project-chevron" size={16} />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="za-panel-bottom-link"
            onClick={() => navigate("/projects")}
          >
            Explore the full project portfolio
            <ArrowRight size={15} />
          </button>
        </article>

        {/* TEAM OVERVIEW */}

        <article className="za-panel za-teams-panel">
          <div className="za-panel-heading">
            <div>
              <span className="za-panel-eyebrow">YOUR ORGANIZATION</span>

              <h2>Team overview</h2>

              <p>See how your teams are progressing.</p>
            </div>

            <button
              type="button"
              className="za-panel-icon-link"
              aria-label="Open teams"
              onClick={() => navigate("/teams")}
            >
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="za-team-summary">
            <div className="za-team-summary-number">
              <strong>{teams.length}</strong>

              <span>{teams.length === 1 ? "Team" : "Teams"}</span>
            </div>

            <div className="za-team-summary-detail">
              <span className="za-summary-dot" />
              <span>{activeTasks.length} tasks currently in progress</span>
            </div>
          </div>

          <div className="za-team-list">
            {teamSummaries.length === 0 ? (
              <div className="za-team-empty">
                <Layers size={22} />

                <strong>No teams yet</strong>

                <span>Create a team to organize your projects.</span>
              </div>
            ) : (
              teamSummaries.slice(0, 4).map((team, index) => (
                <button
                  type="button"
                  className="za-team-row"
                  key={team.displayId}
                  onClick={() => navigate("/teams")}
                >
                  <span
                    className={`za-team-avatar za-team-avatar-${(index % 4) + 1}`}
                  >
                    {getInitials(team.name)}
                  </span>

                  <span className="za-team-copy">
                    <strong>{team.name || "Unnamed team"}</strong>

                    <small>
                      {team.projectCount}{" "}
                      {team.projectCount === 1 ? "project" : "projects"}
                    </small>
                  </span>

                  <span className="za-team-progress">
                    <span className="za-team-progress-track">
                      <span
                        style={{
                          width: `${team.progress}%`,
                        }}
                      />
                    </span>

                    <small>{team.progress}%</small>
                  </span>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="za-panel-bottom-link"
            onClick={() => navigate("/teams")}
          >
            Manage your teams
            <ArrowRight size={15} />
          </button>
        </article>

        {/* MEMBER DIRECTORY */}

        <article className="za-panel za-members-panel" id="za-member-directory">
          <div className="za-panel-heading">
            <div>
              <span className="za-panel-eyebrow">PEOPLE & PERMISSIONS</span>

              <h2>Workspace directory</h2>

              <p>Review the members and roles in this workspace.</p>
            </div>

            <button
              type="button"
              className="za-text-action"
              onClick={() => navigate("/teams")}
            >
              Manage teams
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="za-role-summary">
            <div className="za-role-summary-card">
              <span className="za-role-summary-label">Administrators</span>

              <strong>{roleDistribution.ADMIN}</strong>

              <span className="za-role-summary-mark za-role-mark-admin" />
            </div>

            <div className="za-role-summary-card">
              <span className="za-role-summary-label">HR</span>

              <strong>{roleDistribution.HR}</strong>

              <span className="za-role-summary-mark za-role-mark-hr" />
            </div>

            <div className="za-role-summary-card">
              <span className="za-role-summary-label">Team leaders</span>

              <strong>{roleDistribution.TEAM_LEADER}</strong>

              <span className="za-role-summary-mark za-role-mark-leader" />
            </div>

            <div className="za-role-summary-card">
              <span className="za-role-summary-label">Members</span>

              <strong>{roleDistribution.USER}</strong>

              <span className="za-role-summary-mark za-role-mark-user" />
            </div>
          </div>

          <div className="za-directory-table-wrap">
            <table className="za-directory-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Workspace role</th>
                  <th>Account status</th>
                </tr>
              </thead>

              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="za-directory-empty">
                      {searchQuery
                        ? "No members match your search."
                        : "Workspace members will appear here."}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.slice(0, 6).map((member) => {
                    const accountStatus = getAccountStatus(member);

                    const isActiveAccount = accountStatus === "active";

                    return (
                      <tr
                        key={
                          member.workspace_membership_id ??
                          member.id ??
                          member.user_id
                        }
                      >
                        <td>
                          <div className="za-member-identity">
                            <span className="za-member-avatar">
                              {getInitials(getMemberName(member))}
                            </span>

                            <span className="za-member-text">
                              <strong>{getMemberName(member)}</strong>

                              <small>
                                {member.email || "No email available"}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`za-role-badge za-role-${getRoleClass(member)}`}
                          >
                            {getRoleLabel(member)}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`za-account-status ${
                              isActiveAccount
                                ? "za-account-active"
                                : "za-account-other"
                            }`}
                          >
                            <span />

                            {accountStatus === "unknown"
                              ? "Unknown"
                              : accountStatus.replace(/^./, (char) =>
                                  char.toUpperCase(),
                                )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredMembers.length > 6 && (
            <div className="za-directory-footer">
              Showing 6 of {filteredMembers.length} members.
              <button type="button" onClick={scrollToDirectory}>
                Search directory
              </button>
            </div>
          )}
        </article>

        {/* RECENT ACTIVITY */}

        <article className="za-panel za-activity-panel">
          <div className="za-panel-heading">
            <div>
              <span className="za-panel-eyebrow">WORKSPACE SIGNALS</span>

              <h2>Recent activity</h2>

              <p>Updates from your workspace notifications.</p>
            </div>

            <span className="za-activity-heading-icon">
              <Activity size={17} />
            </span>
          </div>

          <div className="za-activity-list">
            {recentNotifications.length === 0 ? (
              <div className="za-activity-empty">
                <span className="za-activity-empty-icon">
                  <Bell size={21} />
                </span>

                <strong>Nothing new to report</strong>

                <p>
                  Workspace updates will appear here when notifications are
                  available.
                </p>
              </div>
            ) : (
              recentNotifications.map((notification, index) => (
                <button
                  type="button"
                  className="za-activity-row"
                  key={notification.id ?? `${notification.title}-${index}`}
                  onClick={() => navigate("/notifications")}
                >
                  <span
                    className={`za-activity-icon za-activity-icon-${(index % 4) + 1}`}
                  >
                    {index === 0 ? (
                      <Activity size={15} />
                    ) : index === 1 ? (
                      <Users size={15} />
                    ) : index === 2 ? (
                      <FolderKanban size={15} />
                    ) : (
                      <Bell size={15} />
                    )}
                  </span>

                  <span className="za-activity-copy">
                    <strong>{notification.title || "Workspace update"}</strong>

                    <small>
                      {notification.message ||
                        "A workspace notification was received."}
                    </small>

                    <span className="za-activity-time">
                      <Clock3 size={11} />

                      {formatDate(
                        notification.created_at || notification.createdAt,
                      )}
                    </span>
                  </span>

                  <ChevronRight size={15} className="za-activity-chevron" />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="za-panel-bottom-link"
            onClick={() => navigate("/notifications")}
          >
            View all notifications
            <ArrowRight size={15} />
          </button>
        </article>

        {/* ADMINISTRATOR FOOTER CARD */}

        <article className="za-panel za-security-panel">
          <div className="za-security-icon">
            <ShieldCheck size={21} />
          </div>

          <div className="za-security-copy">
            <span className="za-panel-eyebrow">ADMINISTRATION</span>

            <h2>Stay in control.</h2>

            <p>
              Review workspace activity, keep roles organized, and monitor the
              progress of your teams.
            </p>
          </div>

          <button
            type="button"
            className="za-security-button"
            onClick={() => navigate("/profile")}
          >
            Account settings
            <ArrowRight size={15} />
          </button>
        </article>
      </section>

      {/* ======================================================
          FOOTER
      ====================================================== */}

      <footer className="za-dashboard-footer">
        <span>
          <span className="za-footer-brand">ZYRA</span>
          <span className="za-footer-separator">/</span>
          BENTO INTELLIGENCE
        </span>

        <span>
          <span className="za-footer-live-dot" />
          COMPANY ADMIN WORKSPACE
        </span>
      </footer>
    </main>
  );
}

export default AdminDash;
