import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import Notifications from "./pages/Notifications";
import AIAssistant from "./pages/AIAssistant";

import MainLayout from "./layouts/MainLayout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route
            path="/projects/:projectId/tasks/create"
            element={<CreateTask />}
          />
          <Route path="/projects/create" element={<CreateProject />} />
          <Route path="/projects/:projectId" element={<ProjectOverview />} />
          <Route path="/projects/:projectId/tasks" element={<ProjectTasks />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/create" element={<CreateTeam />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
