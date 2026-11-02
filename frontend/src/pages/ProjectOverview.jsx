import {
  FolderKanban,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  CircleCheck,
  Clock3,
  Users,
  CalendarDays,
  Plus,
  X,
  Paperclip,
  Pencil,
  Trash2,
  Save,
  Settings,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { getProjectById } from "../services/ProjectService";
import { getProjectTasks } from "../services/taskService";
import { getTeamById, getTeamMembers } from "../services/teamService";

import {
  getProjectMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "../services/milestoneService";

import {
  getProjectResources,
  createResource,
  updateResource,
  deleteResource,
} from "../services/resourceService";

import { getCurrentUser } from "../services/authService";
import { apiRequest } from "../services/api";
import { useWorkspace } from "../context/WorkspaceContext";

import "../styles/project-overview.css";

const RESOURCE_BASE_URL = "http://10.244.98.140:5000";

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function getResponseArray(response, ...keys) {
  if (Array.isArray(response)) {
    return response;
  }

  for (const key of keys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }

    if (Array.isArray(response?.data?.[key])) {
      return response.data[key];
    }
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
}

function getCandidateUserId(member) {
  return (
    member?.user_id ?? member?.userId ?? member?.user?.id ?? member?.id ?? null
  );
}

function getCandidateRole(member) {
  return String(
    member?.workspace_role ??
      member?.workspaceRole ??
      member?.project_role ??
      member?.projectRole ??
      member?.membership_role ??
      member?.role ??
      member?.user_role ??
      "",
  )
    .trim()
    .toUpperCase();
}

function getCandidateStatus(member) {
  return String(
    member?.account_status ?? member?.accountStatus ?? member?.status ?? "",
  )
    .trim()
    .toUpperCase();
}

function getCandidateName(member) {
  return (
    member?.name ||
    member?.full_name ||
    member?.fullName ||
    member?.user_name ||
    member?.username ||
    member?.user?.name ||
    member?.user?.full_name ||
    member?.email ||
    member?.user?.email ||
    "Team Leader"
  );
}

function sameId(first, second) {
  if (
    first === null ||
    first === undefined ||
    first === "" ||
    second === null ||
    second === undefined ||
    second === ""
  ) {
    return false;
  }

  return String(first) === String(second);
}

/* =========================================================
   PROJECT OVERVIEW
   ========================================================= */

function ProjectOverview() {
  const navigate = useNavigate();
  const { projectId } = useParams();

  const {
    activeWorkspace,
    workspaceType,
    workspaceRole,
    loading: workspaceLoading,
  } = useWorkspace();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [resources, setResources] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     COMPANY PROJECT FORWARDING STATE
     ========================================================= */

  const [showForwardModal, setShowForwardModal] = useState(false);

  const [loadingTeamLeaders, setLoadingTeamLeaders] = useState(false);
  const [forwardingProject, setForwardingProject] = useState(false);

  const [availableTeamLeaders, setAvailableTeamLeaders] = useState([]);
  const [selectedTeamLeaderId, setSelectedTeamLeaderId] = useState("");

  const [forwardedTeamLeader, setForwardedTeamLeader] = useState(null);
  const [forwardError, setForwardError] = useState("");

  /* =========================================================
     MILESTONE STATE
     ========================================================= */

  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDescription, setMilestoneDescription] = useState("");
  const [milestoneDeadline, setMilestoneDeadline] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState("pending");

  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState(null);

  const [editMilestoneName, setEditMilestoneName] = useState("");
  const [editMilestoneDescription, setEditMilestoneDescription] = useState("");
  const [editMilestoneDeadline, setEditMilestoneDeadline] = useState("");
  const [editMilestoneStatus, setEditMilestoneStatus] = useState("pending");

  /* =========================================================
     RESOURCE STATE
     ========================================================= */

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [creatingResource, setCreatingResource] = useState(false);

  const [resourceName, setResourceName] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceFile, setResourceFile] = useState(null);

  const [editingResourceId, setEditingResourceId] = useState(null);
  const [updatingResourceId, setUpdatingResourceId] = useState(null);

  const [editResourceName, setEditResourceName] = useState("");
  const [editResourceDescription, setEditResourceDescription] = useState("");
  const [editResourceUrl, setEditResourceUrl] = useState("");

  /* =========================================================
     LOAD PROJECT
     ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadProjectOverview() {
      try {
        setLoading(true);
        setError("");

        setForwardedTeamLeader(null);

        const projectData = await getProjectById(projectId);

        if (cancelled) return;

        const loadedProject =
          projectData?.project ||
          projectData?.data?.project ||
          projectData?.data ||
          projectData;

        if (
          !loadedProject ||
          typeof loadedProject !== "object" ||
          Array.isArray(loadedProject)
        ) {
          throw new Error("Unable to load the requested project.");
        }

        setProject(loadedProject);

        /* -----------------------------------------------
           LOAD PROJECT TASKS
        ----------------------------------------------- */

        const loadedTasks = await getProjectTasks(projectId);

        if (cancelled) return;

        const normalizedTasks = getResponseArray(loadedTasks, "tasks");

        setTasks(normalizedTasks);

        /* -----------------------------------------------
           LOAD MILESTONES
        ----------------------------------------------- */

        const loadedMilestones = await getProjectMilestones(projectId);

        if (cancelled) return;

        const normalizedMilestones = getResponseArray(
          loadedMilestones,
          "milestones",
        );

        setMilestones(normalizedMilestones);

        /* -----------------------------------------------
           LOAD RESOURCES
        ----------------------------------------------- */

        const loadedResources = await getProjectResources(projectId);

        if (cancelled) return;

        const normalizedResources = getResponseArray(
          loadedResources,
          "resources",
        );

        setResources(normalizedResources);

        /* -----------------------------------------------
           LOAD CURRENT USER
        ----------------------------------------------- */

        try {
          const userData = await getCurrentUser();

          if (cancelled) return;

          const signedInUser =
            userData?.user ||
            userData?.data?.user ||
            userData?.data ||
            userData;

          setCurrentUser(signedInUser || null);
        } catch (userError) {
          console.error("Current user loading error:", userError);
          setCurrentUser(null);
        }

        /* -----------------------------------------------
           LOAD COMPANY PROJECT MEMBERS

           This is only needed for Company projects.
           It allows the HR user to see whether a Team
           Leader has already been forwarded the project.

           Individual projects never call this endpoint.
        ----------------------------------------------- */

        const loadedWorkspaceType = String(
          loadedProject?.workspace_type ||
            loadedProject?.workspaceType ||
            loadedProject?.workspace?.type ||
            loadedProject?.workspace?.workspace_type ||
            activeWorkspace?.type ||
            activeWorkspace?.workspace_type ||
            workspaceType ||
            "",
        )
          .trim()
          .toUpperCase();

        if (loadedWorkspaceType === "COMPANY") {
          try {
            const memberResponse = await apiRequest(
              `/projects/${encodeURIComponent(projectId)}/members`,
            );

            if (cancelled) return;

            const projectMembers = getResponseArray(
              memberResponse,
              "members",
              "projectMembers",
              "project_members",
            );

            const assignedTeamLeader = projectMembers.find((member) => {
              return getCandidateRole(member) === "TEAM_LEADER";
            });

            if (assignedTeamLeader) {
              setForwardedTeamLeader(assignedTeamLeader);
            }
          } catch (memberError) {
            /*
             * The project overview should still load if
             * the member lookup is unavailable.
             *
             * Forwarding itself will display its own
             * error if the related endpoint is unavailable.
             */
            console.error("Company project member loading error:", memberError);
          }
        }

        /* -----------------------------------------------
           LOAD PROJECT TEAM

           Independent Company projects may not have a
           team yet, so this section is optional.
        ----------------------------------------------- */

        const projectTeamId =
          loadedProject?.team_id ??
          loadedProject?.teamId ??
          loadedProject?.team?.id;

        if (
          projectTeamId !== null &&
          projectTeamId !== undefined &&
          projectTeamId !== ""
        ) {
          try {
            await getTeamById(projectTeamId);

            const members = await getTeamMembers(projectTeamId);

            if (cancelled) return;

            const normalizedMembers = getResponseArray(members, "members");

            setTeamMembers(normalizedMembers);
          } catch (teamError) {
            console.error("Project team loading error:", teamError);

            if (!cancelled) {
              setTeamMembers([]);
            }
          }
        } else {
          setTeamMembers([]);
        }
      } catch (loadError) {
        console.error("Project overview loading error:", loadError);

        if (!cancelled) {
          setError(loadError.message || "Failed to load project information.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (projectId && !workspaceLoading) {
      loadProjectOverview();
    }

    return () => {
      cancelled = true;
    };
  }, [projectId, workspaceLoading, workspaceType, activeWorkspace?.id]);

  /* =========================================================
     TASK CALCULATIONS
     ========================================================= */

  const completedTasks = useMemo(
    () =>
      tasks.filter((task) =>
        ["completed", "complete", "done"].includes(
          String(task.status || "")
            .trim()
            .toLowerCase(),
        ),
      ),
    [tasks],
  );

  const activeTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !["completed", "complete", "done"].includes(
            String(task.status || "")
              .trim()
              .toLowerCase(),
          ),
      ),
    [tasks],
  );

  const progressPercentage =
    tasks.length > 0
      ? Math.round((completedTasks.length / tasks.length) * 100)
      : 0;

  const overdueTasks = useMemo(() => {
    const today = new Date();

    return tasks.filter((task) => {
      if (!task.deadline) {
        return false;
      }

      const deadline = new Date(task.deadline);

      return (
        deadline < today &&
        !["completed", "complete", "done"].includes(
          String(task.status || "")
            .trim()
            .toLowerCase(),
        )
      );
    });
  }, [tasks]);

  /* =========================================================
     PROJECT DATA
     ========================================================= */

  const projectStatus = project?.status || project?.project_status || "Active";

  const projectDeadline =
    project?.deadline || project?.due_date || project?.end_date || null;

  const projectHealth = project?.health || project?.health_status || null;

  const projectBudget = project?.budget || project?.budget_percentage || null;

  const projectRisk = project?.risk || project?.risk_level || null;

  const formattedDeadline = projectDeadline
    ? new Date(projectDeadline).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

  /* =========================================================
     COMPANY PROJECT PERMISSIONS
     ========================================================= */

  const normalizedWorkspaceType = String(
    project?.workspace_type ||
      project?.workspaceType ||
      project?.workspace?.type ||
      project?.workspace?.workspace_type ||
      activeWorkspace?.type ||
      activeWorkspace?.workspace_type ||
      workspaceType ||
      "",
  )
    .trim()
    .toUpperCase();

  const normalizedWorkspaceRole = String(
    workspaceRole || activeWorkspace?.role || "",
  )
    .trim()
    .toUpperCase();

  const isCompanyProject = normalizedWorkspaceType === "COMPANY";

  const isCompanyAdmin =
    isCompanyProject && normalizedWorkspaceRole === "ADMIN";

  const isCompanyHR = isCompanyProject && normalizedWorkspaceRole === "HR";

  const isCompanyTeamLeader =
    isCompanyProject && normalizedWorkspaceRole === "TEAM_LEADER";

  const currentUserId =
    currentUser?.id ?? currentUser?.user_id ?? currentUser?.userId ?? null;

  const projectCreatorId = project?.created_by ?? project?.createdBy ?? null;

  const assignedHrId =
    project?.assigned_hr_user_id ??
    project?.assignedHrUserId ??
    project?.assigned_hr_id ??
    null;

  const isProjectCreator = sameId(currentUserId, projectCreatorId);

  const isAssignedHR = sameId(currentUserId, assignedHrId);

  const projectTeamId =
    project?.team_id ?? project?.teamId ?? project?.team?.id ?? null;

  const hasProjectTeam =
    projectTeamId !== null &&
    projectTeamId !== undefined &&
    projectTeamId !== "";

  /*
   * COMPANY TASK CREATION RULES
   *
   * ADMIN:
   *   Can create tasks.
   *
   * HR:
   *   Can create tasks only if HR originally created
   *   this project.
   *
   * TEAM LEADER:
   *   Can create tasks after the project has been
   *   attached to a team.
   *
   * USER:
   *   Cannot create project tasks.
   *
   * NON-COMPANY:
   *   Keep the original Create Task button.
   *   This preserves the Individual workflow.
   */

  const canCreateProjectTask = !isCompanyProject
    ? true
    : isCompanyAdmin ||
      (isCompanyHR && isProjectCreator) ||
      (isCompanyTeamLeader && hasProjectTeam);

  /*
   * HR can forward an independent Company project
   * when HR is either:
   *
   * 1. The original project creator, or
   * 2. The HR assigned to the project by Admin.
   *
   * Forwarding is hidden after the project is attached
   * to a team.
   */

  const canForwardProject =
    isCompanyProject &&
    isCompanyHR &&
    !hasProjectTeam &&
    (isProjectCreator || isAssignedHR);

  const forwardedTeamLeaderName = forwardedTeamLeader
    ? getCandidateName(forwardedTeamLeader)
    : "";

  /* =========================================================
     MILESTONE HELPERS
     ========================================================= */

  function getMilestoneStatus(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "done";
    }

    if (
      normalized === "in_progress" ||
      normalized === "in-progress" ||
      normalized === "active"
    ) {
      return "active";
    }

    return "pending";
  }

  function getMilestoneStatusLabel(status) {
    const normalized = String(status || "").toLowerCase();

    if (
      normalized === "completed" ||
      normalized === "complete" ||
      normalized === "done"
    ) {
      return "Done";
    }

    if (normalized === "in_progress" || normalized === "in-progress") {
      return "In Progress";
    }

    return "Pending";
  }

  /* =========================================================
     TASK HELPERS
     ========================================================= */

  function getTaskStatusLabel(status) {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (["completed", "complete", "done"].includes(normalized)) {
      return "Done";
    }

    if (["in_progress", "active", "doing"].includes(normalized)) {
      return "In Progress";
    }

    if (["in_review", "review", "under_review"].includes(normalized)) {
      return "In Review";
    }

    return "Pending";
  }

  function getTaskStatusClass(status) {
    const normalized = String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

    if (["completed", "complete", "done"].includes(normalized)) {
      return "done";
    }

    if (["in_progress", "active", "doing"].includes(normalized)) {
      return "progress";
    }

    if (["in_review", "review", "under_review"].includes(normalized)) {
      return "review";
    }

    return "pending";
  }

  function formatTaskDeadline(deadline) {
    if (!deadline) {
      return "—";
    }

    const date = new Date(deadline);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  /* =========================================================
     TEAM MEMBER HELPERS
     ========================================================= */

  function getMemberId(member) {
    return (
      member?.id ??
      member?.user_id ??
      member?.userId ??
      member?.member_id ??
      member?.user?.id ??
      null
    );
  }

  function getMemberName(member) {
    const nestedUser = member?.user || {};

    return (
      member?.name ||
      member?.full_name ||
      member?.user_name ||
      member?.username ||
      nestedUser?.name ||
      nestedUser?.full_name ||
      nestedUser?.username ||
      member?.email ||
      nestedUser?.email ||
      "Member"
    );
  }

  function getMemberEmail(member) {
    return member?.email || member?.user_email || member?.user?.email || "";
  }

  function getMemberInitials(member) {
    const name = getMemberName(member);
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
  }

  /* =========================================================
     TASK ASSIGNEE LOOKUP
     ========================================================= */

  function getTaskAssignee(task) {
    if (!task) {
      return "Unassigned";
    }

    const directName =
      task?.assigned_to_name ||
      task?.assignedToName ||
      task?.assigned_user_name ||
      task?.assignedUserName ||
      task?.assignee_name ||
      task?.assigneeName ||
      task?.assigned_to_username ||
      task?.assignedToUsername;

    if (
      directName &&
      String(directName).trim() &&
      String(directName).trim().toLowerCase() !== "unassigned"
    ) {
      return String(directName).trim();
    }

    const nestedAssignee =
      (task?.assignee && typeof task.assignee === "object"
        ? task.assignee
        : null) ||
      (task?.assigned_user && typeof task.assigned_user === "object"
        ? task.assigned_user
        : null) ||
      (task?.assignedUser && typeof task.assignedUser === "object"
        ? task.assignedUser
        : null) ||
      null;

    if (nestedAssignee) {
      const nestedName = getMemberName(nestedAssignee);

      if (nestedName !== "Member") {
        return nestedName;
      }
    }

    const rawAssignedId =
      task?.assigned_to ??
      task?.assignedTo ??
      task?.assigned_user_id ??
      task?.assignedUserId ??
      task?.assignee_id ??
      task?.assigneeId ??
      nestedAssignee?.id ??
      nestedAssignee?.user_id ??
      null;

    if (
      rawAssignedId === null ||
      rawAssignedId === undefined ||
      rawAssignedId === ""
    ) {
      if (typeof task?.assignee === "string") {
        const legacyAssignee = task.assignee.trim();

        return legacyAssignee || "Unassigned";
      }

      return "Unassigned";
    }

    const assignedId =
      typeof rawAssignedId === "object"
        ? (rawAssignedId?.id ??
          rawAssignedId?.user_id ??
          rawAssignedId?.userId ??
          rawAssignedId?.member_id ??
          null)
        : rawAssignedId;

    if (assignedId === null || assignedId === undefined || assignedId === "") {
      return "Unassigned";
    }

    const assignedMember = teamMembers.find((member) => {
      const memberId = getMemberId(member);

      return (
        memberId !== null &&
        memberId !== undefined &&
        String(memberId) === String(assignedId)
      );
    });

    if (assignedMember) {
      return getMemberName(assignedMember);
    }

    if (typeof assignedId === "string" && Number.isNaN(Number(assignedId))) {
      const normalizedAssignedValue = assignedId.trim().toLowerCase();

      const matchingMember = teamMembers.find((member) => {
        return [getMemberName(member), getMemberEmail(member)].some(
          (value) =>
            value &&
            String(value).trim().toLowerCase() === normalizedAssignedValue,
        );
      });

      if (matchingMember) {
        return getMemberName(matchingMember);
      }

      return assignedId;
    }

    return `Assigned user #${assignedId}`;
  }

  /* =========================================================
     OPEN FORWARD PROJECT MODAL
     ========================================================= */

  async function handleOpenForwardModal() {
    if (!canForwardProject || loadingTeamLeaders) {
      return;
    }

    setForwardError("");
    setAvailableTeamLeaders([]);
    setSelectedTeamLeaderId("");
    setShowForwardModal(true);

    try {
      setLoadingTeamLeaders(true);

      /*
       * This endpoint should return the members eligible
       * for this HR to assign to the Company project.
       *
       * The backend should enforce the HR reporting
       * relationship and Company workspace restrictions.
       */

      const response = await apiRequest(
        `/projects/${encodeURIComponent(projectId)}/eligible-members`,
      );

      const eligibleMembers = getResponseArray(
        response,
        "members",
        "eligibleMembers",
        "eligible_members",
        "users",
      );

      /*
       * Only active Team Leaders should appear here.
       *
       * When account status is not included in the response,
       * the backend eligibility endpoint remains responsible
       * for returning only eligible active accounts.
       */

      const teamLeaders = eligibleMembers.filter((member) => {
        const role = getCandidateRole(member);
        const status = getCandidateStatus(member);

        const memberUserId = getCandidateUserId(member);

        return (
          role === "TEAM_LEADER" &&
          memberUserId !== null &&
          memberUserId !== undefined &&
          memberUserId !== "" &&
          (!status || status === "ACTIVE")
        );
      });

      setAvailableTeamLeaders(teamLeaders);

      if (teamLeaders.length > 0) {
        setSelectedTeamLeaderId(String(getCandidateUserId(teamLeaders[0])));
      } else {
        setForwardError(
          "No eligible active Team Leaders are available for this project.",
        );
      }
    } catch (loadError) {
      console.error("Eligible Team Leader loading error:", loadError);

      setForwardError(
        loadError.message ||
          "Unable to load eligible Team Leaders. Please try again.",
      );
    } finally {
      setLoadingTeamLeaders(false);
    }
  }

  /* =========================================================
     FORWARD PROJECT TO TEAM LEADER
     ========================================================= */

  async function handleForwardProject(event) {
    event.preventDefault();

    if (!canForwardProject) {
      setForwardError("You do not have permission to forward this project.");
      return;
    }

    const selectedId = Number(selectedTeamLeaderId);

    if (!Number.isInteger(selectedId) || selectedId <= 0) {
      setForwardError("Please select a valid Team Leader.");
      return;
    }

    const selectedLeader = availableTeamLeaders.find(
      (member) => String(getCandidateUserId(member)) === String(selectedId),
    );

    if (!selectedLeader) {
      setForwardError("The selected Team Leader is not available.");
      return;
    }

    try {
      setForwardingProject(true);
      setForwardError("");
      setError("");

      /*
       * Add the selected Team Leader to the project with
       * the TEAM_LEADER project role.
       *
       * The backend must validate:
       * - The requester is the project's assigned/creator HR.
       * - The target is an eligible Company Team Leader.
       * - Both belong to the correct Company workspace.
       */

      await apiRequest(`/projects/${encodeURIComponent(projectId)}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: selectedId,
          role: "TEAM_LEADER",
        }),
      });

      /*
       * Keep the HR project page updated immediately.
       * The page will also reload the assignment from the
       * project members endpoint when reopened.
       */

      setForwardedTeamLeader(selectedLeader);
      setShowForwardModal(false);
      setSelectedTeamLeaderId("");
      setAvailableTeamLeaders([]);
      setForwardError("");
    } catch (forwardErrorValue) {
      console.error("Project forwarding error:", forwardErrorValue);

      setForwardError(
        forwardErrorValue.message ||
          "Failed to forward the project. Please try again.",
      );
    } finally {
      setForwardingProject(false);
    }
  }

  /* =========================================================
     CLOSE FORWARD MODAL
     ========================================================= */

  function handleCloseForwardModal() {
    if (forwardingProject) {
      return;
    }

    setShowForwardModal(false);
    setForwardError("");
    setSelectedTeamLeaderId("");
    setAvailableTeamLeaders([]);
  }

  /* =========================================================
     CREATE MILESTONE
     ========================================================= */

  async function handleCreateMilestone(event) {
    event.preventDefault();

    const name = milestoneName.trim();
    const description = milestoneDescription.trim();

    if (!name) {
      setError("Please enter a milestone name.");
      return;
    }

    try {
      setCreatingMilestone(true);
      setError("");

      const newMilestone = await createMilestone({
        name,
        description,
        projectId: Number(projectId),
        deadline: milestoneDeadline || null,
        status: milestoneStatus,
      });

      setMilestones((current) => [...current, newMilestone]);

      setMilestoneName("");
      setMilestoneDescription("");
      setMilestoneDeadline("");
      setMilestoneStatus("pending");
      setShowMilestoneForm(false);
    } catch (createError) {
      console.error("Milestone creation error:", createError);

      setError(createError.message || "Failed to create milestone.");
    } finally {
      setCreatingMilestone(false);
    }
  }

  /* =========================================================
     EDIT MILESTONE
     ========================================================= */

  function startEditingMilestone(milestone) {
    setError("");

    setEditingMilestoneId(milestone.id);
    setEditMilestoneName(milestone.name || "");
    setEditMilestoneDescription(milestone.description || "");

    setEditMilestoneDeadline(
      milestone.deadline ? String(milestone.deadline).slice(0, 10) : "",
    );

    setEditMilestoneStatus(milestone.status || "pending");
  }

  function cancelEditingMilestone() {
    setEditingMilestoneId(null);
    setEditMilestoneName("");
    setEditMilestoneDescription("");
    setEditMilestoneDeadline("");
    setEditMilestoneStatus("pending");
  }

  async function handleUpdateMilestone(event, milestoneId) {
    event.preventDefault();

    const name = editMilestoneName.trim();
    const description = editMilestoneDescription.trim();

    if (!name) {
      setError("Please enter a milestone name.");
      return;
    }

    try {
      setUpdatingMilestoneId(milestoneId);
      setError("");

      const updatedMilestone = await updateMilestone(milestoneId, {
        name,
        description,
        deadline: editMilestoneDeadline || null,
        status: editMilestoneStatus,
      });

      setMilestones((current) =>
        current.map((milestone) =>
          milestone.id === milestoneId ? updatedMilestone : milestone,
        ),
      );

      cancelEditingMilestone();
    } catch (updateError) {
      console.error("Milestone update error:", updateError);

      setError(updateError.message || "Failed to update milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  /* =========================================================
     DELETE MILESTONE
     ========================================================= */

  async function handleDeleteMilestone(milestoneId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this milestone?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setUpdatingMilestoneId(milestoneId);

      await deleteMilestone(milestoneId);

      setMilestones((current) =>
        current.filter((milestone) => milestone.id !== milestoneId),
      );
    } catch (deleteError) {
      console.error("Milestone deletion error:", deleteError);

      setError(deleteError.message || "Failed to delete milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  }

  /* =========================================================
     CREATE RESOURCE
     ========================================================= */

  async function handleCreateResource(event) {
    event.preventDefault();

    const name = resourceName.trim();
    const description = resourceDescription.trim();
    const url = resourceUrl.trim();

    if (!name) {
      setError("Please enter a resource name.");
      return;
    }

    if (!url && !resourceFile) {
      setError("Please provide a resource URL or choose a file.");
      return;
    }

    try {
      setCreatingResource(true);
      setError("");

      const newResource = await createResource({
        name,
        description,
        url,
        file: resourceFile,
        projectId: Number(projectId),
      });

      setResources((current) => [...current, newResource]);

      setResourceName("");
      setResourceDescription("");
      setResourceUrl("");
      setResourceFile(null);
      setShowResourceForm(false);
    } catch (createError) {
      console.error("Resource creation error:", createError);

      setError(createError.message || "Failed to create resource.");
    } finally {
      setCreatingResource(false);
    }
  }

  /* =========================================================
     RESOURCE PERMISSION
     ========================================================= */

  function canEditResource(resource) {
    if (!currentUser?.id || !resource?.uploaded_by) {
      return false;
    }

    return Number(resource.uploaded_by) === Number(currentUser.id);
  }

  /* =========================================================
     EDIT RESOURCE
     ========================================================= */

  function startEditingResource(resource) {
    setError("");

    setEditingResourceId(resource.id);
    setEditResourceName(resource.name || "");
    setEditResourceDescription(resource.description || "");
    setEditResourceUrl(resource.url || "");
  }

  function cancelEditingResource() {
    setEditingResourceId(null);
    setEditResourceName("");
    setEditResourceDescription("");
    setEditResourceUrl("");
  }

  async function handleUpdateResource(event, resourceId) {
    event.preventDefault();

    const name = editResourceName.trim();
    const description = editResourceDescription.trim();
    const url = editResourceUrl.trim();

    if (!name) {
      setError("Please enter a resource name.");
      return;
    }

    if (!url) {
      setError("Please enter a resource URL.");
      return;
    }

    try {
      setUpdatingResourceId(resourceId);
      setError("");

      const updatedResource = await updateResource(resourceId, {
        name,
        description,
        url,
      });

      setResources((current) =>
        current.map((resource) =>
          resource.id === resourceId ? updatedResource : resource,
        ),
      );

      cancelEditingResource();
    } catch (updateError) {
      console.error("Resource update error:", updateError);

      setError(updateError.message || "Failed to update resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  /* =========================================================
     DELETE RESOURCE
     ========================================================= */

  async function handleDeleteResource(resourceId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this resource?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setUpdatingResourceId(resourceId);

      await deleteResource(resourceId);

      setResources((current) =>
        current.filter((resource) => resource.id !== resourceId),
      );
    } catch (deleteError) {
      console.error("Resource deletion error:", deleteError);

      setError(deleteError.message || "Failed to delete resource.");
    } finally {
      setUpdatingResourceId(null);
    }
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="zyra-project-overview">
      {/* TOPBAR */}

      <div className="project-page-topbar">
        <button
          type="button"
          className="project-back-button"
          onClick={() => navigate("/projects")}
        >
          <ArrowLeft size={16} />
          Projects
        </button>

        <div className="project-topbar-title">
          <FolderKanban size={17} />
          <span>Project Workspace</span>
        </div>
      </div>

      {error && <div className="project-overview-error">{error}</div>}

      {/* HERO */}

      <section className="project-hero-card">
        <div className="project-hero-content">
          <div className="project-hero-title-row">
            <div>
              <div className="project-hero-title-line">
                <h1>
                  {loading
                    ? "Loading Project..."
                    : project?.name || "Project Overview"}
                </h1>

                <span className="project-status-badge">
                  {String(projectStatus).toUpperCase()}
                  {tasks.length > 0 ? ` (${progressPercentage}%)` : ""}
                </span>
              </div>

              <p>
                {project?.description ||
                  "Manage your project, tasks, milestones, team and resources from one workspace."}
              </p>
            </div>
          </div>
        </div>

        <div className="project-hero-actions">
          {/* -----------------------------------------------
              CREATE TASK

              Individual:
              Original Create Task action is preserved.

              Company:
              Display depends on the Company role and
              project creator permissions.
          ----------------------------------------------- */}

          {canCreateProjectTask && (
            <button
              type="button"
              className="project-action primary"
              onClick={() => navigate(`/projects/${projectId}/tasks/create`)}
            >
              <Plus size={16} />
              Create Task
            </button>
          )}

          {/* -----------------------------------------------
              COMPANY HR — FORWARD TO TEAM LEADER

              This action is only available for eligible
              independent Company projects.
          ----------------------------------------------- */}

          {canForwardProject && (
            <button
              type="button"
              className="project-action secondary"
              onClick={handleOpenForwardModal}
              disabled={
                loading || Boolean(forwardedTeamLeader) || loadingTeamLeaders
              }
              title={
                forwardedTeamLeader
                  ? `Forwarded to ${forwardedTeamLeaderName}`
                  : "Forward this project to an eligible Team Leader"
              }
            >
              <UserPlus size={16} />

              {forwardedTeamLeader
                ? `Forwarded to ${forwardedTeamLeaderName}`
                : loadingTeamLeaders
                  ? "Loading Team Leaders..."
                  : "Forward to Team Leader"}
            </button>
          )}

          <button
            type="button"
            className="project-action secondary"
            onClick={() => {
              if (projectTeamId) {
                navigate(`/teams/${projectTeamId}`);
              }
            }}
            disabled={!hasProjectTeam}
          >
            <UserPlus size={16} />
            Invite Team
          </button>

          <button
            type="button"
            className="project-action secondary"
            onClick={() => navigate(`/projects/${projectId}/tasks`)}
          >
            <Pencil size={15} />
            Edit Project
          </button>

          <button
            type="button"
            className="project-action secondary disabled-action"
            disabled
            title="Project settings will be available later."
          >
            <Settings size={15} />
            Project Settings
          </button>
        </div>
      </section>

      {/* MAIN GRID */}

      <div className="project-dashboard-grid">
        {/* MAIN COLUMN */}

        <main className="project-main-column">
          {/* SUMMARY */}

          <section className="project-summary-grid">
            <div className="project-progress-card">
              <div
                className="project-progress-ring"
                style={{
                  "--progress": `${progressPercentage * 3.6}deg`,
                }}
              >
                <div className="project-progress-inner">
                  <span>OVERALL PROGRESS</span>

                  <strong>{loading ? "—" : `${progressPercentage}%`}</strong>

                  <small>
                    Completed: {completedTasks.length}/{tasks.length} Tasks
                  </small>
                </div>
              </div>
            </div>

            <div className="project-metric-grid">
              <div className="project-metric-card health">
                <div className="metric-card-top">
                  <span>Health:</span>
                  <TrendingUp size={17} />
                </div>

                <strong>
                  {projectHealth
                    ? String(projectHealth).toUpperCase()
                    : "ON TRACK"}
                </strong>

                <div className="metric-progress">
                  <span
                    style={{
                      width: `${Math.max(progressPercentage, 10)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="project-metric-card budget">
                <div className="metric-card-top">
                  <span>Budget:</span>
                  <FolderKanban size={16} />
                </div>

                <strong>
                  {projectBudget !== null && projectBudget !== undefined
                    ? `${projectBudget}%`
                    : "—"}
                </strong>

                <div className="metric-progress">
                  <span
                    style={{
                      width:
                        projectBudget !== null && projectBudget !== undefined
                          ? `${Math.min(Number(projectBudget) || 0, 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="project-metric-card risks">
                <div className="metric-card-top">
                  <span>Risks:</span>
                  <AlertTriangle size={17} />
                </div>

                <strong>
                  {projectRisk
                    ? String(projectRisk).toUpperCase()
                    : overdueTasks.length > 0
                      ? `${overdueTasks.length} OVERDUE`
                      : "LOW"}
                </strong>
              </div>

              <div className="project-metric-card deadline">
                <div className="metric-card-top">
                  <span>Deadline:</span>
                  <CalendarDays size={17} />
                </div>

                <strong>{formattedDeadline}</strong>
              </div>
            </div>
          </section>

          {/* ACTIVE TASKS */}

          <section className="project-panel active-tasks-panel">
            <div className="project-panel-header">
              <div>
                <h2>ACTIVE TASKS ({activeTasks.length})</h2>
              </div>

              <button
                type="button"
                className="sort-tasks-button"
                onClick={() => navigate(`/projects/${projectId}/tasks`)}
              >
                View all
                <ArrowRight size={14} />
              </button>
            </div>

            {activeTasks.length === 0 ? (
              <div className="project-empty-state compact">
                <CheckSquare size={24} />
                <span>No active tasks</span>
              </div>
            ) : (
              <div className="active-task-list">
                {activeTasks.slice(0, 6).map((task, index) => {
                  const taskId = task.id ?? task.task_id ?? index;
                  const assigneeName = getTaskAssignee(task);

                  return (
                    <button
                      type="button"
                      className="active-task-row"
                      key={taskId}
                      onClick={() =>
                        navigate(`/projects/${projectId}/tasks/${taskId}`)
                      }
                    >
                      <div className="task-row-check">
                        <span />
                      </div>

                      <div className="task-row-name">
                        {task.title || task.name || "Untitled Task"}
                      </div>

                      <div className="task-row-assignee">
                        <div className="task-mini-avatar">
                          {getMemberInitials({
                            name: assigneeName,
                          })}
                        </div>

                        <span>{assigneeName}</span>
                      </div>

                      <span
                        className={`task-status-pill ${getTaskStatusClass(
                          task.status,
                        )}`}
                      >
                        {getTaskStatusLabel(task.status)}
                      </span>

                      <span className="task-row-deadline">
                        {formatTaskDeadline(task.deadline || task.due_date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        {/* SIDE COLUMN */}

        <aside className="project-side-column">
          {/* TEAM — TOP */}

          <section className="project-panel team-panel">
            <div className="project-panel-header">
              <h2>TEAM MEMBERS ({teamMembers.length})</h2>

              <button
                type="button"
                className="panel-icon-button"
                onClick={() => {
                  if (projectTeamId) {
                    navigate(`/teams/${projectTeamId}`);
                  }
                }}
                disabled={!hasProjectTeam}
              >
                <MoreHorizontal size={17} />
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="project-empty-state compact">
                <Users size={22} />
                <span>No team members</span>
              </div>
            ) : (
              <div className="team-member-list">
                {teamMembers.slice(0, 6).map((member, index) => (
                  <div
                    className="team-member-item"
                    key={getMemberId(member) ?? getMemberName(member) ?? index}
                  >
                    <div className="team-member-avatar">
                      {getMemberInitials(member)}
                    </div>

                    <div className="team-member-info">
                      <strong>{getMemberName(member)}</strong>

                      {member.role && <span>{member.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {teamMembers.length > 6 && (
              <button
                type="button"
                className="team-more-button"
                onClick={() => navigate(`/teams/${projectTeamId}`)}
              >
                +{teamMembers.length - 6} more
              </button>
            )}
          </section>

          {/* ACTIVITY — SECOND */}

          <section className="project-panel activity-panel">
            <div className="project-panel-header">
              <h2>RECENT ACTIVITY</h2>

              <button type="button" className="panel-icon-button" disabled>
                <MoreHorizontal size={17} />
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="project-empty-state compact">
                <Clock3 size={22} />
                <span>No recent activity</span>
              </div>
            ) : (
              <div className="activity-list">
                {tasks.slice(0, 4).map((task, index) => {
                  const taskName = task.title || task.name || "Task";
                  const status = getTaskStatusLabel(task.status);

                  return (
                    <div
                      className="activity-item"
                      key={task.id || task.task_id || `${taskName}-${index}`}
                    >
                      <span className={`activity-dot activity-${index % 3}`} />

                      <div className="activity-content">
                        <p>
                          <strong>{getTaskAssignee(task)}</strong> — {taskName}
                        </p>

                        <span>{status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>

      {/* =====================================================
          PROJECT MANAGEMENT
          ===================================================== */}

      <section className="project-management-panel">
        <div className="project-management-header">
          <div>
            <span className="management-eyebrow">PROJECT MANAGEMENT</span>

            <h2>Milestones & Resources</h2>

            <p>
              Manage the detailed project information without leaving the
              workspace.
            </p>
          </div>
        </div>

        {/* ===================================================
            RESOURCES
            =================================================== */}

        <div className="resources-management">
          <div className="resource-management-header">
            <div>
              <span className="management-eyebrow">RESOURCES</span>

              <h3>Project Resources</h3>
            </div>

            {!showResourceForm && (
              <button
                type="button"
                className="management-secondary-button"
                onClick={() => {
                  setShowResourceForm(true);
                  setError("");
                }}
              >
                <Plus size={15} />
                Add Resource
              </button>
            )}
          </div>

          {showResourceForm && (
            <form
              className="project-management-form"
              onSubmit={handleCreateResource}
            >
              <div className="management-form-grid">
                <div className="form-group">
                  <label>Resource Name</label>

                  <input
                    type="text"
                    placeholder="Enter resource name"
                    value={resourceName}
                    onChange={(event) => setResourceName(event.target.value)}
                    disabled={creatingResource}
                  />
                </div>

                <div className="form-group">
                  <label>Choose File</label>

                  <input
                    type="file"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] || null;
                      setResourceFile(selectedFile);
                    }}
                    disabled={creatingResource}
                  />

                  {resourceFile && <small>Selected: {resourceFile.name}</small>}
                </div>

                <div className="form-group">
                  <label>Resource URL</label>

                  <input
                    type="url"
                    placeholder="https://example.com"
                    value={resourceUrl}
                    onChange={(event) => setResourceUrl(event.target.value)}
                    disabled={creatingResource}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>

                  <textarea
                    rows="2"
                    placeholder="Enter resource description"
                    value={resourceDescription}
                    onChange={(event) =>
                      setResourceDescription(event.target.value)
                    }
                    disabled={creatingResource}
                  />
                </div>
              </div>

              <div className="management-form-actions">
                <button
                  type="button"
                  className="management-secondary-button"
                  onClick={() => {
                    setShowResourceForm(false);
                    setResourceName("");
                    setResourceDescription("");
                    setResourceUrl("");
                    setResourceFile(null);
                    setError("");
                  }}
                  disabled={creatingResource}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="management-primary-button"
                  disabled={
                    creatingResource ||
                    !resourceName.trim() ||
                    (!resourceUrl.trim() && !resourceFile)
                  }
                >
                  <Plus size={15} />

                  {creatingResource ? "Adding..." : "Add Resource"}
                </button>
              </div>
            </form>
          )}

          {resources.length === 0 ? (
            <div className="project-empty-state">
              <Paperclip size={24} />
              <span>No resources added yet.</span>
            </div>
          ) : (
            <div className="resource-list">
              {resources.map((resource) =>
                editingResourceId === resource.id ? (
                  <form
                    className="management-item editing"
                    key={resource.id}
                    onSubmit={(event) =>
                      handleUpdateResource(event, resource.id)
                    }
                  >
                    <div className="management-form-grid">
                      <div className="form-group">
                        <label>Name</label>

                        <input
                          type="text"
                          value={editResourceName}
                          onChange={(event) =>
                            setEditResourceName(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>URL</label>

                        <input
                          type="url"
                          value={editResourceUrl}
                          onChange={(event) =>
                            setEditResourceUrl(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>

                      <div className="form-group full-width">
                        <label>Description</label>

                        <textarea
                          rows="2"
                          value={editResourceDescription}
                          onChange={(event) =>
                            setEditResourceDescription(event.target.value)
                          }
                          disabled={updatingResourceId === resource.id}
                        />
                      </div>
                    </div>

                    <div className="management-form-actions">
                      <button
                        type="button"
                        className="management-secondary-button"
                        onClick={cancelEditingResource}
                        disabled={updatingResourceId === resource.id}
                      >
                        <X size={14} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="management-primary-button"
                        disabled={
                          updatingResourceId === resource.id ||
                          !editResourceName.trim() ||
                          !editResourceUrl.trim()
                        }
                      >
                        <Save size={14} />

                        {updatingResourceId === resource.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="management-item" key={resource.id}>
                    <div className="management-item-info">
                      <div className="management-item-icon">
                        <Paperclip size={17} />
                      </div>

                      <div>
                        <strong>{resource.name}</strong>

                        {resource.description && <p>{resource.description}</p>}

                        {resource.file_path ? (
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/projects/${projectId}/file`, {
                                state: {
                                  fileUrl: `${RESOURCE_BASE_URL}${resource.file_path}`,
                                  fileName: resource.file_name || resource.name,
                                  projectId: Number(projectId),
                                },
                              })
                            }
                          >
                            Open File
                          </button>
                        ) : resource.url ? (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Resource
                          </a>
                        ) : null}

                        {resource.file_name && (
                          <span>{resource.file_name}</span>
                        )}
                      </div>
                    </div>

                    {canEditResource(resource) && (
                      <div className="management-item-actions">
                        <button
                          type="button"
                          className="management-icon-button"
                          onClick={() => startEditingResource(resource)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          type="button"
                          className="management-icon-button danger"
                          onClick={() => handleDeleteResource(resource.id)}
                          disabled={updatingResourceId === resource.id}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* ===================================================
            MILESTONES BELOW RESOURCES
            =================================================== */}

        <div className="milestones-management">
          <div className="resource-management-header">
            <div>
              <span className="management-eyebrow">MILESTONES</span>

              <h3>Project Milestones</h3>
            </div>

            {!showMilestoneForm && (
              <button
                type="button"
                className="management-secondary-button"
                onClick={() => {
                  setShowMilestoneForm(true);
                  setError("");
                }}
              >
                <Plus size={15} />
                Add Milestone
              </button>
            )}
          </div>

          {showMilestoneForm && (
            <form
              className="project-management-form"
              onSubmit={handleCreateMilestone}
            >
              <div className="management-form-grid">
                <div className="form-group">
                  <label>Milestone Name</label>

                  <input
                    type="text"
                    placeholder="Enter milestone name"
                    value={milestoneName}
                    onChange={(event) => setMilestoneName(event.target.value)}
                    disabled={creatingMilestone}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Deadline</label>

                  <input
                    type="date"
                    value={milestoneDeadline}
                    onChange={(event) =>
                      setMilestoneDeadline(event.target.value)
                    }
                    disabled={creatingMilestone}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Description</label>

                  <textarea
                    rows="3"
                    placeholder="Enter milestone description"
                    value={milestoneDescription}
                    onChange={(event) =>
                      setMilestoneDescription(event.target.value)
                    }
                    disabled={creatingMilestone}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>

                  <select
                    value={milestoneStatus}
                    onChange={(event) => setMilestoneStatus(event.target.value)}
                    disabled={creatingMilestone}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="management-form-actions">
                <button
                  type="button"
                  className="management-secondary-button"
                  onClick={() => {
                    setShowMilestoneForm(false);
                    setMilestoneName("");
                    setMilestoneDescription("");
                    setMilestoneDeadline("");
                    setMilestoneStatus("pending");
                    setError("");
                  }}
                  disabled={creatingMilestone}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="management-primary-button"
                  disabled={creatingMilestone || !milestoneName.trim()}
                >
                  <Plus size={15} />

                  {creatingMilestone ? "Creating..." : "Create Milestone"}
                </button>
              </div>
            </form>
          )}

          {milestones.length === 0 ? (
            <div className="project-empty-state">
              <CircleCheck size={24} />

              <span>No milestones added yet.</span>
            </div>
          ) : (
            <div className="management-list">
              {milestones.map((milestone) =>
                editingMilestoneId === milestone.id ? (
                  <form
                    className="management-item editing"
                    key={milestone.id}
                    onSubmit={(event) =>
                      handleUpdateMilestone(event, milestone.id)
                    }
                  >
                    <div className="management-edit-grid">
                      <div className="form-group">
                        <label>Name</label>

                        <input
                          type="text"
                          value={editMilestoneName}
                          onChange={(event) =>
                            setEditMilestoneName(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Deadline</label>

                        <input
                          type="date"
                          value={editMilestoneDeadline}
                          onChange={(event) =>
                            setEditMilestoneDeadline(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Description</label>

                        <textarea
                          rows="2"
                          value={editMilestoneDescription}
                          onChange={(event) =>
                            setEditMilestoneDescription(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        />
                      </div>

                      <div className="form-group">
                        <label>Status</label>

                        <select
                          value={editMilestoneStatus}
                          onChange={(event) =>
                            setEditMilestoneStatus(event.target.value)
                          }
                          disabled={updatingMilestoneId === milestone.id}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>

                    <div className="management-form-actions">
                      <button
                        type="button"
                        className="management-secondary-button"
                        onClick={cancelEditingMilestone}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <X size={14} />
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="management-primary-button"
                        disabled={
                          updatingMilestoneId === milestone.id ||
                          !editMilestoneName.trim()
                        }
                      >
                        <Save size={14} />

                        {updatingMilestoneId === milestone.id
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="management-item" key={milestone.id}>
                    <div className="management-item-info">
                      <div className="management-item-icon">
                        <CircleCheck size={17} />
                      </div>

                      <div>
                        <strong>{milestone.name}</strong>

                        {milestone.description && (
                          <p>{milestone.description}</p>
                        )}

                        <span>
                          {getMilestoneStatusLabel(milestone.status)}

                          {milestone.deadline &&
                            ` • ${formatTaskDeadline(milestone.deadline)}`}
                        </span>
                      </div>
                    </div>

                    <div className="management-item-actions">
                      <button
                        type="button"
                        className="management-icon-button"
                        onClick={() => startEditingMilestone(milestone)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        type="button"
                        className="management-icon-button danger"
                        onClick={() => handleDeleteMilestone(milestone.id)}
                        disabled={updatingMilestoneId === milestone.id}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          FORWARD PROJECT MODAL
          ===================================================== */}

      {showForwardModal && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !forwardingProject) {
              handleCloseForwardModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
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
            aria-labelledby="forward-project-title"
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
                  PROJECT RESPONSIBILITY
                </span>

                <h2
                  id="forward-project-title"
                  style={{
                    margin: 0,
                    fontSize: "21px",
                    fontWeight: 650,
                  }}
                >
                  Forward to Team Leader
                </h2>

                <p
                  style={{
                    margin: "9px 0 0",
                    color: "#94a3b8",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Select an eligible Team Leader to take responsibility for this
                  project.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseForwardModal}
                disabled={forwardingProject}
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
                  cursor: forwardingProject ? "not-allowed" : "pointer",
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* MODAL BODY */}

            <form onSubmit={handleForwardProject}>
              <div style={{ marginBottom: "18px" }}>
                <label
                  htmlFor="forward-team-leader"
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

                {loadingTeamLeaders ? (
                  <div
                    style={{
                      padding: "16px",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      borderRadius: "10px",
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    Loading eligible Team Leaders...
                  </div>
                ) : availableTeamLeaders.length > 0 ? (
                  <select
                    id="forward-team-leader"
                    value={selectedTeamLeaderId}
                    onChange={(event) =>
                      setSelectedTeamLeaderId(event.target.value)
                    }
                    disabled={forwardingProject}
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

                    {availableTeamLeaders.map((leader) => {
                      const leaderId = getCandidateUserId(leader);

                      return (
                        <option key={leaderId} value={String(leaderId)}>
                          {getCandidateName(leader)}
                          {leader.email ? ` — ${leader.email}` : ""}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div
                    style={{
                      padding: "14px",
                      border: "1px solid rgba(148, 163, 184, 0.18)",
                      borderRadius: "10px",
                      color: "#94a3b8",
                      fontSize: "13px",
                      lineHeight: 1.6,
                    }}
                  >
                    No eligible Team Leaders are currently available.
                  </div>
                )}
              </div>

              {/* FORWARD ERROR */}

              {forwardError && (
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
                  {forwardError}
                </div>
              )}

              {/* MODAL ACTIONS */}

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
                  onClick={handleCloseForwardModal}
                  disabled={forwardingProject}
                  style={{
                    minHeight: "40px",
                    padding: "0 16px",
                    border: "1px solid rgba(148, 163, 184, 0.25)",
                    borderRadius: "9px",
                    background: "transparent",
                    color: "#cbd5e1",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: forwardingProject ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    forwardingProject ||
                    loadingTeamLeaders ||
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
                      forwardingProject ||
                      loadingTeamLeaders ||
                      availableTeamLeaders.length === 0 ||
                      !selectedTeamLeaderId
                        ? "#334155"
                        : "linear-gradient(135deg, #2563eb, #4f46e5)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 650,
                    cursor:
                      forwardingProject ||
                      loadingTeamLeaders ||
                      availableTeamLeaders.length === 0 ||
                      !selectedTeamLeaderId
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      forwardingProject ||
                      loadingTeamLeaders ||
                      availableTeamLeaders.length === 0 ||
                      !selectedTeamLeaderId
                        ? 0.65
                        : 1,
                  }}
                >
                  <UserPlus size={15} />

                  {forwardingProject ? "Forwarding..." : "Confirm Forward"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProjectOverview;
