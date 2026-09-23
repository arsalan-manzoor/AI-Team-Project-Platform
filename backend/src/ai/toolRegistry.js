const tools = {
    get_projects: {
        name: "get_projects",
        type: "read",
        description: "Get projects the authenticated user is authorized to access.",
        parameters: {},
        returns: "Authorized projects for the authenticated user."
    },

    get_project: {
        name: "get_project",
        type: "read",
        description: "Get a specific project and its authorized context.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Authorized project details, tasks, and milestones."
    },

    get_tasks: {
        name: "get_tasks",
        type: "read",
        description: "Get tasks the authenticated user is authorized to access.",
        parameters: {},
        returns: "Authorized tasks for the authenticated user."
    },

    get_task: {
        name: "get_task",
        type: "read",
        description: "Get a specific task and its authorized context.",
        parameters: {
            task_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Authorized task details, subtasks, comments, and related context."
    },

    get_team_members: {
        name: "get_team_members",
        type: "read",
        description: "Get members of a team the authenticated user belongs to.",
        parameters: {
            team_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Authorized team details and member information."
    },

    get_milestones: {
        name: "get_milestones",
        type: "read",
        description: "Get milestones the authenticated user is authorized to access.",
        parameters: {
            milestone_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Authorized milestone details and related project task context."
    },

    get_notifications: {
        name: "get_notifications",
        type: "read",
        description: "Get notifications belonging to the authenticated user.",
        parameters: {},
        returns: "Notifications belonging to the authenticated user."
    },

    get_recent_activity: {
        name: "get_recent_activity",
        type: "read",
        description: "Get recent activity for an authorized project.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Recent activity for an authorized project."
    },

    get_project_summary_data: {
        name: "get_project_summary_data",
        type: "read",
        description: "Get authorized project data needed to generate a project summary.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns: "Authorized project details, tasks, and milestones for summary generation."
    }
};

module.exports = tools;