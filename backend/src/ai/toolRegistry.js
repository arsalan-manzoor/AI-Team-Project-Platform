const tools = {
    get_projects: {
        name: "get_projects",
        type: "read",
        description: "Get projects the authenticated user is authorized to access."
    },

    get_project: {
        name: "get_project",
        type: "read",
        description: "Get a specific project and its authorized context."
    },

    get_tasks: {
        name: "get_tasks",
        type: "read",
        description: "Get tasks the authenticated user is authorized to access."
    },

    get_task: {
        name: "get_task",
        type: "read",
        description: "Get a specific task and its authorized context."
    },

    get_team_members: {
        name: "get_team_members",
        type: "read",
        description: "Get members of a team the authenticated user belongs to."
    },

    get_milestones: {
        name: "get_milestones",
        type: "read",
        description: "Get milestones the authenticated user is authorized to access."
    },

    get_notifications: {
        name: "get_notifications",
        type: "read",
        description: "Get notifications belonging to the authenticated user."
    },

    get_recent_activity: {
        name: "get_recent_activity",
        type: "read",
        description: "Get recent activity for an authorized project."
    },

    get_project_summary_data: {
        name: "get_project_summary_data",
        type: "read",
        description: "Get authorized project data needed to generate a project summary."
    }
};

module.exports = tools;