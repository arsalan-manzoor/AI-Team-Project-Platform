import { BrowserRouter, Routes, Route } from "react-router-dom";

// ========================================================
// PUBLIC PAGES
// ========================================================

import Landing from "./pages/Landing";
import IndividualLanding from "./pages/IndividualLanding";
import CompanyLanding from "./pages/CompanyLanding";

// ========================================================
// AUTHENTICATION
// ========================================================

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import CompanyLogin from "./pages/CompanyLogin";
import CompanySignup from "./pages/CompanySignup";

// ========================================================
// DASHBOARDS
// ========================================================

// General UI-only dashboard
import Dashboard from "./pages/Dashboard";
import Invitations from "./pages/Invitations";

// Individual workspace dashboards
import LeadDash from "./pages/LeadDash";
import UserDash from "./pages/UserDash";

// Company workspace dashboards
import AdminDash from "./pages/AdminDash";
import HRDash from "./pages/HRDash";
import TeamDash from "./pages/TeamDash";
import MemberDash from "./pages/MemberDash";

// ========================================================
// PROJECT PAGES
// ========================================================

import Projects from "./pages/Projects";
import ProjectTasks from "./pages/ProjectTasks";
import CreateTask from "./pages/CreateTask";
import ProjectOverview from "./pages/ProjectOverview";
import CreateProject from "./pages/CreateProject";
import TaskDetails from "./pages/TaskDetails";
import FileViewer from "./pages/FileViewer";

// ========================================================
// TEAM PAGES
// ========================================================

import Teams from "./pages/Teams";
import CreateTeam from "./pages/CreateTeam";
import TeamDetails from "./pages/TeamDetails";

// ========================================================
// OTHER WORKSPACE PAGES
// ========================================================

import Tasks from "./pages/Tasks";
import Notifications from "./pages/Notifications";
import AIAssistant from "./pages/AIAssistant";
import Profile from "./pages/Profile";
import MyCompany from "./pages/MyCompany";
import EmployeeManagement from "./pages/EmployeeManagement";

// ========================================================
// LAYOUTS AND ACCESS PROTECTION
// ========================================================

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// ========================================================
// EMPLOYEE INVITATIONS
// ========================================================

import EmployeeInvitation from "./pages/EmployeeInvitation";
// reporting structure page

import ReportingStructure from "./pages/ReportingStructure";

// ========================================================
// MAIN APPLICATION
// ========================================================

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================================================
            PUBLIC PAGES
        ================================================ */}

        <Route path="/" element={<Landing />} />

        <Route path="/individual" element={<IndividualLanding />} />

        <Route path="/company" element={<CompanyLanding />} />

        {/* ================================================
            INDIVIDUAL AUTHENTICATION
        ================================================ */}

        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />

        {/* ================================================
            COMPANY AUTHENTICATION
        ================================================ */}

        <Route path="/company/login" element={<CompanyLogin />} />

        <Route path="/company/signup" element={<CompanySignup />} />

        {/* ================================================
            EMPLOYEE INVITATIONS
        ================================================ */}

        <Route
          path="/employee-invitation/id/:invitationId"
          element={<EmployeeInvitation />}
        />

        <Route
          path="/employee-invitation/:token"
          element={<EmployeeInvitation />}
        />

        {/* ================================================
            PROTECTED WORKSPACE
        ================================================ */}

        <Route element={<ProtectedRoute />}>
          {/* ==============================================
              SHARED APPLICATION LAYOUT

              All dashboard and workspace pages below use
              MainLayout and the existing global Sidebar.
          ============================================== */}

          <Route element={<MainLayout />}>
            {/* ----------------------------------------------
                GENERAL DASHBOARD — UI ONLY
            ---------------------------------------------- */}

            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/invitations" element={<Invitations />} />

            {/* ----------------------------------------------
                ACTUAL INDIVIDUAL USER DASHBOARD

                Uses the reference-image design.
            ---------------------------------------------- */}

            <Route path="/dashboard/individual/user" element={<UserDash />} />

            {/* ----------------------------------------------
                INDIVIDUAL TEAM LEADER DASHBOARD
            ---------------------------------------------- */}

            <Route
              path="/dashboard/individual/team-leader"
              element={<LeadDash />}
            />

            {/* ----------------------------------------------
                COMPANY ADMIN DASHBOARD
            ---------------------------------------------- */}

            <Route path="/dashboard/company/admin" element={<AdminDash />} />

            {/* ----------------------------------------------
                COMPANY HR DASHBOARD
            ---------------------------------------------- */}

            <Route path="/dashboard/company/hr" element={<HRDash />} />

            {/* ----------------------------------------------
                COMPANY TEAM LEADER DASHBOARD
            ---------------------------------------------- */}

            <Route
              path="/dashboard/company/team-leader"
              element={<TeamDash />}
            />

            {/* ----------------------------------------------
                COMPANY MEMBER DASHBOARD
            ---------------------------------------------- */}

            <Route path="/dashboard/company/user" element={<MemberDash />} />

            {/* ----------------------------------------------
                PROFILE
            ---------------------------------------------- */}

            <Route path="/my-company" element={<MyCompany />} />
            <Route path="/employees" element={<EmployeeManagement />} />
            <Route path="/profile" element={<Profile />} />

            {/* ----------------------------------------------
                PROJECTS
            ---------------------------------------------- */}

            <Route path="/projects" element={<Projects />} />

            <Route path="/projects/create" element={<CreateProject />} />

            <Route path="/projects/:projectId" element={<ProjectOverview />} />

            {/* ----------------------------------------------
                PROJECT TASKS
            ---------------------------------------------- */}

            <Route
              path="/projects/:projectId/tasks"
              element={<ProjectTasks />}
            />

            <Route path="/projects/:projectId/file" element={<FileViewer />} />

            <Route
              path="/projects/:projectId/tasks/:taskId"
              element={<TaskDetails />}
            />

            <Route
              path="/projects/:projectId/tasks/create"
              element={<CreateTask />}
            />

            {/* ----------------------------------------------
                MY TASKS
            ---------------------------------------------- */}

            <Route path="/tasks" element={<Tasks />} />

            {/* ----------------------------------------------
                TEAMS
            ---------------------------------------------- */}

            <Route path="/teams" element={<Teams />} />

            <Route path="/teams/create" element={<CreateTeam />} />

            <Route path="/teams/:teamId" element={<TeamDetails />} />
            <Route
              path="/company/reporting-structure"
              element={<ReportingStructure />}
            />

            {/* ----------------------------------------------
                NOTIFICATIONS
            ---------------------------------------------- */}

            <Route path="/notifications" element={<Notifications />} />

            {/* ----------------------------------------------
                AI ASSISTANT
            ---------------------------------------------- */}

            <Route path="/ai-assistant" element={<AIAssistant />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
