import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectTasks from "./pages/ProjectTasks";
import CreateTask from "./pages/CreateTask";
import ProjectOverview from "./pages/ProjectOverview";
import CreateProject from "./pages/CreateProject";
import Tasks from "./pages/Tasks";
import Teams from "./pages/Teams";
import CreateTeam from "./pages/CreateTeam";
import TeamDetails from "./pages/TeamDetails";
import Notifications from "./pages/Notifications";
import AIAssistant from "./pages/AIAssistant";
import TaskDetails from "./pages/TaskDetails";
import MainLayout from "./layouts/MainLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        {/* Main Workspace */}
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Projects */}
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/create" element={<CreateProject />} />

          {/* Project Overview */}
          <Route path="/projects/:projectId" element={<ProjectOverview />} />

          {/* Project Tasks */}
          <Route path="/projects/:projectId/tasks" element={<ProjectTasks />} />
          {/*  TaskDetails  */}
          <Route
            path="/projects/:projectId/tasks/:taskId"
            element={<TaskDetails />}
          />

          {/* Create Project Task */}
          <Route
            path="/projects/:projectId/tasks/create"
            element={<CreateTask />}
          />

          {/* My Tasks */}
          <Route path="/tasks" element={<Tasks />} />

          {/* Teams */}
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/create" element={<CreateTeam />} />
          <Route path="/teams/:teamId" element={<TeamDetails />} />

          {/* Activity */}
          <Route path="/notifications" element={<Notifications />} />

          {/* AI */}
          <Route path="/ai-assistant" element={<AIAssistant />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
