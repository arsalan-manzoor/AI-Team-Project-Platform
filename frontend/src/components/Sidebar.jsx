import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Bell,
  Sparkles,
} from "lucide-react";

function Sidebar() {
  return (
    <aside className="zyra-sidebar">
      <div className="sidebar-section">
        <p className="sidebar-title">WORKSPACE</p>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <LayoutDashboard className="sidebar-icon" size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/projects"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <FolderKanban className="sidebar-icon" size={18} />
            <span>My Projects</span>
          </NavLink>

          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <CheckSquare className="sidebar-icon" size={18} />
            <span>My Tasks</span>
          </NavLink>

          <NavLink
            to="/teams"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Users className="sidebar-icon" size={18} />
            <span>Teams</span>
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-section">
        <p className="sidebar-title">ACTIVITY</p>

        <nav className="sidebar-nav">
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              isActive ? "sidebar-link active" : "sidebar-link"
            }
          >
            <Bell className="sidebar-icon" size={18} />
            <span>Notifications</span>
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-ai">
        <NavLink to="/ai-assistant" className="ai-sidebar-link">
          <div className="ai-icon">
            <Sparkles size={18} />
          </div>

          <div>
            <strong>AI Assistant</strong>
            <span>Work smarter with ZYRA</span>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;
