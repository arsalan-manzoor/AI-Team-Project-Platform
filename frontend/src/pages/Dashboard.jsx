import {
  FolderKanban,
  CheckSquare,
  Users,
  Clock3,
  ArrowRight,
  Plus,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import { getProjects } from "../services/ProjectService";
import { getCurrentUser } from "../services/authService";
import { getTeams, getTeamMembers } from "../services/teamService";
import { getTasks } from "../services/taskService";

function Dashboard() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [teamMemberCount, setTeamMemberCount] = useState(0);
  const [tasks, setTasks] = useState([]);

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

        let totalMembers = 0;

        await Promise.all(
          loadedTeams.map(async (team) => {
            try {
              const members = await getTeamMembers(team.id);

              if (Array.isArray(members)) {
                totalMembers += members.length;
              }
            } catch (error) {
              console.error(
                `Failed to load members for team ${team.id}:`,
                error,
              );
            }
          }),
        );

        setTeamMemberCount(totalMembers);
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

  return (
    <div className="zyra-dashboard">
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

      <div className="dashboard-stats">
        {/* Total Projects */}
        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <FolderKanban size={20} />
          </div>

          <div className="stat-content">
            <span>Total Projects</span>

            <strong>{loading ? "..." : projects.length}</strong>
          </div>
        </div>

        {/* Active Tasks */}
        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <CheckSquare size={20} />
          </div>

          <div className="stat-content">
            <span>Active Tasks</span>

            <strong>{loading ? "..." : activeTaskCount}</strong>
          </div>
        </div>

        {/* Team Members */}
        <div className="dashboard-stat-card">
          <div className="stat-icon">
            <Users size={20} />
          </div>

          <div className="stat-content">
            <span>Team Members</span>

            <strong>{loading ? "..." : teamMemberCount}</strong>
          </div>
        </div>

        {/* Pending Tasks */}
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

      <div className="dashboard-grid">
        {/* Recent Projects */}
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>Recent Projects</h3>

              <p>Your latest project activity</p>
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
                <div
                  key={project.id}
                  className="dashboard-project-item"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div>
                    <h4>{project.name}</h4>

                    <p>{project.description || "No description provided."}</p>
                  </div>

                  <ArrowRight size={17} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* My Tasks */}
        <section className="dashboard-panel">
          <div className="panel-header">
            <div>
              <h3>My Tasks</h3>

              <p>Tasks assigned to you</p>
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

              <p>Getting your tasks from the ZYRA workspace.</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="dashboard-empty">
              <CheckSquare size={30} />

              <h4>No tasks yet</h4>

              <p>
                Your assigned tasks will appear here once you start working on a
                project.
              </p>
            </div>
          ) : (
            <div className="dashboard-project-list">
              {tasks.slice(0, 5).map((task) => (
                <div key={task.id} className="dashboard-project-item">
                  <div>
                    <h4>{task.title}</h4>

                    <p>Status: {task.status || "Unknown"}</p>
                  </div>

                  <ArrowRight size={17} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* AI Assistant */}
      <section className="dashboard-ai-panel">
        <div className="ai-panel-icon">✦</div>

        <div className="ai-panel-content">
          <span>ZYRA AI ASSISTANT</span>

          <h3>Your intelligent project assistant is coming.</h3>

          <p>
            ZYRA will eventually help you understand project progress, identify
            delayed work, summarize information, and provide intelligent
            recommendations.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
