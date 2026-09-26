import {
  Activity,
  ArrowRight,
  CheckSquare,
  Clock3,
  FileText,
  FolderKanban,
  MessageSquare,
  Network,
  Plus,
  Settings2,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";

import "../styles/dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);

  const [selectedMember, setSelectedMember] = useState(null);
  const [showMessagePanel, setShowMessagePanel] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const [projectsData, userData, teamsData, tasksData] =
          await Promise.all([
            getProjects(),
            getCurrentUser(),
            getTeams(),
            getTasks(),
          ]);

        const loadedProjects = Array.isArray(projectsData) ? projectsData : [];

        const loadedTeams = Array.isArray(teamsData) ? teamsData : [];

        const loadedTasks = Array.isArray(tasksData) ? tasksData : [];

        setProjects(loadedProjects);
        setUser(userData);
        setTasks(loadedTasks);

        const assignedTasks = loadedTasks.filter(
          (task) =>
            task.assigned_to !== null &&
            task.assigned_to !== undefined &&
            Number(task.assigned_to) === Number(userData.id),
        );

        setMyTasks(assignedTasks);

        let totalMembers = 0;
        let allMembers = [];

        await Promise.all(
          loadedTeams.map(async (team) => {
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
            } catch (error) {
              console.error(
                `Failed to load members for team ${team.id}:`,
                error,
              );
            }
          }),
        );

        const uniqueMembers = Array.from(
          new Map(
            allMembers.map((member) => [member.id || member.user_id, member]),
          ).values(),
        );

        setTeamMemberCount(totalMembers);
        setTeamMembers(uniqueMembers);
      } catch (error) {
        console.error("Dashboard loading error:", error);

        setError(error.message || "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const recentProjects = projects.slice(0, 5);

  const activeTaskCount = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "active",
  ).length;

  const pendingTaskCount = tasks.filter(
    (task) => task.status === "pending" || task.status === "todo",
  ).length;

  const completedTaskCount = tasks.filter(
    (task) =>
      task.status === "completed" ||
      task.status === "complete" ||
      task.status === "done",
  ).length;

  const activityItems = [
    {
      id: 1,
      type: "task",
      title: "Task activity",
      description:
        myTasks[0]?.title || "Your workspace task activity will appear here.",
      time: "Today",
      icon: CheckSquare,
    },
    {
      id: 2,
      type: "project",
      title: "Project activity",
      description:
        projects[0]?.name || "Your recent project activity will appear here.",
      time: "Today",
      icon: FolderKanban,
    },
    {
      id: 3,
      type: "team",
      title: "Team activity",
      description:
        teamMembers[0]?.name ||
        teamMembers[0]?.user_name ||
        "Your team workspace is active.",
      time: "Today",
      icon: Users,
    },
    {
      id: 4,
      type: "workspace",
      title: "Workspace status",
      description: "ZYRA is monitoring your workspace information.",
      time: "Today",
      icon: Activity,
    },
  ];

  function getDisplayStatus(status) {
    switch (status) {
      case "in_progress":
        return "In Progress";

      case "completed":
      case "complete":
      case "done":
        return "Completed";

      case "pending":
      case "todo":
        return "To Do";

      default:
        return status || "Unknown";
    }
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

  function getMemberInitials(member) {
    const name = getMemberName(member);

    return name
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

  function openMemberMessage() {
    setShowMessagePanel(true);
  }

  return (
    <div className="zyra-dashboard">
      {/* =====================================================
          WORKSPACE OVERVIEW
          ===================================================== */}

      <section className="dashboard-overview">
        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">WORKSPACE OVERVIEW</p>

            <h2>Welcome back, {user?.name || "User"}</h2>

            <p className="dashboard-subtitle">
              Here's what's happening across your projects and teams.
            </p>
          </div>

          <button
            className="dashboard-create-btn"
            onClick={() => navigate("/projects/create")}
          >
            <Plus size={17} />
            Create Project
          </button>
        </div>

        {error && <div className="dashboard-error">{error}</div>}

        {/* =====================================================
            WORKSPACE STATISTICS
            ===================================================== */}

        <div className="dashboard-stats">
          <div className="dashboard-stat-card">
            <div className="stat-icon">
              <FolderKanban size={20} />
            </div>

            <div className="stat-content">
              <span>Total Projects</span>

              <strong>{loading ? "..." : projects.length}</strong>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-icon">
              <CheckSquare size={20} />
            </div>

            <div className="stat-content">
              <span>Active Tasks</span>

              <strong>{loading ? "..." : activeTaskCount}</strong>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-icon">
              <Users size={20} />
            </div>

            <div className="stat-content">
              <span>Team Members</span>

              <strong>{loading ? "..." : teamMemberCount}</strong>
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div className="stat-icon">
              <Clock3 size={20} />
            </div>

            <div className="stat-content">
              <span>Pending Tasks</span>

              <strong>{loading ? "..." : pendingTaskCount}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ZYRA INTELLIGENCE NETWORK
          ===================================================== */}

      <section className="intelligence-network-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">ZYRA INTELLIGENCE NETWORK</p>

            <h3>Living Workspace</h3>

            <p>
              Your workspace information flows through the ZYRA intelligence
              layer.
            </p>
          </div>

          <div className="network-status">
            <span className="network-status-dot" />
            Workspace Connected
          </div>
        </div>

        <div className="intelligence-network">
          <div className="network-lines" aria-hidden="true">
            <span className="network-line line-projects" />
            <span className="network-line line-tasks" />
            <span className="network-line line-members" />
            <span className="network-line line-files" />
            <span className="network-line line-resources" />
            <span className="network-line line-activity" />
          </div>

          <div className="network-packet packet-one" />
          <div className="network-packet packet-two" />
          <div className="network-packet packet-three" />

          <button
            type="button"
            className="network-node network-node-projects"
            onClick={() => navigate("/projects")}
          >
            <FolderKanban size={18} />
            <span>Projects</span>
          </button>

          <button
            type="button"
            className="network-node network-node-tasks"
            onClick={() => navigate("/tasks")}
          >
            <CheckSquare size={18} />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            className="network-node network-node-members"
            onClick={() => navigate("/teams")}
          >
            <Users size={18} />
            <span>Team Members</span>
          </button>

          <button type="button" className="network-node network-node-files">
            <FileText size={18} />
            <span>Files</span>
          </button>

          <button type="button" className="network-node network-node-resources">
            <Settings2 size={18} />
            <span>Resources</span>
          </button>

          <button type="button" className="network-node network-node-activity">
            <Activity size={18} />
            <span>Activity</span>
          </button>

          <div className="intelligence-core">
            <div className="core-orbit core-orbit-one" />
            <div className="core-orbit core-orbit-two" />

            <div className="core-inner">
              <Sparkles size={22} />

              <strong>ZYRA</strong>

              <span>INTELLIGENCE CORE</span>
            </div>
          </div>

          <div className="network-context">
            <span>WORKSPACE CONTEXT</span>
            <strong>
              {projects.length} projects · {tasks.length} tasks
            </strong>
          </div>
        </div>
      </section>

      {/* =====================================================
          LOWER INTELLIGENCE AREA
          ===================================================== */}

      <section className="dashboard-intelligence-grid">
        {/* ===================================================
            TODAY'S ACTIVITY
            =================================================== */}

        <section className="dashboard-panel activity-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">LIVE WORKSPACE</p>

              <h3>Today's Activity</h3>

              <p>Recent workspace signals and team activity.</p>
            </div>

            <Activity size={18} />
          </div>

          <div className="activity-list">
            {activityItems.map((item) => {
              const ActivityIcon = item.icon;

              return (
                <button
                  type="button"
                  key={item.id}
                  className="activity-item"
                  onClick={() => {
                    if (item.type === "project") {
                      navigate("/projects");
                    }

                    if (item.type === "task") {
                      navigate("/tasks");
                    }

                    if (item.type === "team") {
                      navigate("/teams");
                    }
                  }}
                >
                  <div className="activity-icon">
                    <ActivityIcon size={15} />
                  </div>

                  <div className="activity-content">
                    <strong>{item.title}</strong>

                    <span>{item.description}</span>
                  </div>

                  <time>{item.time}</time>
                </button>
              );
            })}
          </div>
        </section>

        {/* ===================================================
            TEAM MEMBERS
            =================================================== */}

        <section className="dashboard-panel team-members-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">COLLABORATION</p>

              <h3>Team Members</h3>

              <p>People connected to your workspace.</p>
            </div>

            <button
              type="button"
              className="panel-link"
              onClick={() => navigate("/teams")}
            >
              View team
              <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="dashboard-empty compact-empty">
              <Users size={28} />

              <h4>Loading team members...</h4>
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="dashboard-empty compact-empty">
              <Users size={28} />

              <h4>No team members found</h4>

              <p>Team members will appear here once they are connected.</p>
            </div>
          ) : (
            <div className="team-member-list">
              {teamMembers.slice(0, 5).map((member) => (
                <button
                  type="button"
                  key={member.id || member.user_id}
                  className="team-member-item"
                  onClick={() => handleMemberClick(member)}
                >
                  <div className="member-avatar">
                    {getMemberInitials(member)}
                  </div>

                  <div className="member-info">
                    <strong>{getMemberName(member)}</strong>

                    <span>{member.teamName || "Workspace Member"}</span>
                  </div>

                  <span className="member-status">
                    <span />
                    Active
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ===================================================
            ZYRA AI INSIGHTS
            =================================================== */}

        <section className="dashboard-panel ai-insights-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">INTELLIGENCE</p>

              <h3>ZYRA AI Insights</h3>

              <p>Workspace intelligence is being prepared.</p>
            </div>

            <Sparkles size={18} />
          </div>

          <div className="ai-insight-list">
            <div className="ai-insight-item">
              <div className="ai-insight-icon">
                <Zap size={15} />
              </div>

              <div>
                <strong>Active workload</strong>

                <span>
                  {activeTaskCount} task
                  {activeTaskCount === 1 ? "" : "s"} currently active.
                </span>
              </div>
            </div>

            <div className="ai-insight-item">
              <div className="ai-insight-icon">
                <CheckSquare size={15} />
              </div>

              <div>
                <strong>Completed work</strong>

                <span>
                  {completedTaskCount} completed task
                  {completedTaskCount === 1 ? "" : "s"} in the workspace.
                </span>
              </div>
            </div>

            <div className="ai-insight-item">
              <div className="ai-insight-icon">
                <Network size={15} />
              </div>

              <div>
                <strong>Context layer</strong>

                <span>
                  ZYRA is preparing deeper project and team understanding.
                </span>
              </div>
            </div>
          </div>
        </section>
      </section>

      {/* =====================================================
          PROJECTS + TASKS
          ===================================================== */}

      <section className="dashboard-grid">
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Projects</h3>

              <p>Your latest project activity.</p>
            </div>

            <button
              className="panel-link"
              onClick={() => navigate("/projects")}
            >
              View all
              <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="dashboard-empty">
              <FolderKanban size={30} />

              <h4>Loading projects...</h4>

              <p>Getting your projects from the ZYRA workspace.</p>
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="dashboard-empty">
              <FolderKanban size={30} />

              <h4>No projects yet</h4>

              <p>
                Create your first project to start organizing your work with
                ZYRA.
              </p>

              <button
                className="empty-action"
                onClick={() => navigate("/projects/create")}
              >
                <Plus size={16} />
                Create Project
              </button>
            </div>
          ) : (
            <div className="dashboard-project-list">
              {recentProjects.map((project) => (
                <button
                  type="button"
                  key={project.id}
                  className="dashboard-project-item"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div>
                    <h4>{project.name}</h4>

                    <p>{project.description || "No description provided."}</p>
                  </div>

                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>My Tasks</h3>

              <p>Tasks assigned to you.</p>
            </div>

            <button className="panel-link" onClick={() => navigate("/tasks")}>
              View all
              <ArrowRight size={15} />
            </button>
          </div>

          {loading ? (
            <div className="dashboard-empty">
              <CheckSquare size={30} />

              <h4>Loading tasks...</h4>

              <p>Getting your assigned tasks from the ZYRA workspace.</p>
            </div>
          ) : myTasks.length === 0 ? (
            <div className="dashboard-empty">
              <CheckSquare size={30} />

              <h4>No tasks assigned</h4>

              <p>
                Your assigned tasks will appear here when you start working on a
                project.
              </p>
            </div>
          ) : (
            <div className="dashboard-project-list">
              {myTasks.slice(0, 5).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  className="dashboard-project-item"
                  onClick={() =>
                    navigate(`/projects/${task.project_id}/tasks/${task.id}`)
                  }
                >
                  <div>
                    <h4>{task.title}</h4>

                    <p>Status: {getDisplayStatus(task.status)}</p>
                  </div>

                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          )}
        </section>
      </section>

      {/* =====================================================
          MEMBER DETAILS / MESSAGE STRUCTURE
          ===================================================== */}

      {selectedMember && (
        <div className="member-details-overlay">
          <section className="member-details-panel">
            <div className="member-details-header">
              <div>
                <p className="panel-eyebrow">TEAM MEMBER</p>

                <h3>{getMemberName(selectedMember)}</h3>
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
                  onClick={openMemberMessage}
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
                  The Dashboard interaction is prepared. Actual messaging will
                  be connected when the messaging backend is available.
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
    </div>
  );
}

export default Dashboard;
