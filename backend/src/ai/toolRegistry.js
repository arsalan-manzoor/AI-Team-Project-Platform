const tools = {
    get_projects: {
        name: "get_projects",
        type: "read",
        description:
            "LIST the projects that the authenticated user is authorized to access. Use this tool when the user asks for their projects, authorized projects, project list, or asks for the name of their project WITHOUT providing a specific project ID. Do NOT use get_project or get_project_summary_data for this request.",
        parameters: {},
        returns:
            "A list of projects authorized for the authenticated user."
    },

    get_project: {
        name: "get_project",
        type: "read",
        description:
            "Get ONE SPECIFIC project when the user provides a project ID. Do not use this tool to list the user's projects.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized details for the specified project, including tasks and milestones."
    },

    get_tasks: {
        name: "get_tasks",
        type: "read",
        description:
            "Get the tasks that the authenticated user is authorized to access. Use this for general task-list requests.",
        parameters: {},
        returns:
            "Authorized tasks for the authenticated user."
    },

    get_task: {
        name: "get_task",
        type: "read",
        description:
            "Get ONE SPECIFIC task when the user provides a task ID.",
        parameters: {
            task_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized details for the specified task, including subtasks, comments, and related context."
    },

    get_team_members: {
        name: "get_team_members",
        type: "read",
        description:
            "Get members of ONE SPECIFIC team when the user provides a team ID and is authorized to access that team.",
        parameters: {
            team_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized team details and member information."
    },

    get_milestones: {
        name: "get_milestones",
        type: "read",
        description:
            "Get ONE SPECIFIC milestone when the user provides a milestone ID.",
        parameters: {
            milestone_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized milestone details and related project task context."
    },

    get_notifications: {
        name: "get_notifications",
        type: "read",
        description:
            "Get notifications belonging to the authenticated user. Use this for general notification requests.",
        parameters: {},
        returns:
            "Notifications belonging to the authenticated user."
    },

    get_recent_activity: {
        name: "get_recent_activity",
        type: "read",
        description:
            "Get recent activity for ONE SPECIFIC authorized project when the user provides a project ID.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Recent activity for the specified authorized project."
    },

    get_project_summary_data: {
        name: "get_project_summary_data",
        type: "read",
        description:
            "Get data for summarizing ONE SPECIFIC project when the user provides a project ID AND explicitly asks for a project summary, project overview, or project status. Do NOT use this tool to list the user's projects or find the name of their projects.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized project details, tasks, and milestones needed for summary generation."
    },

    get_resource: {
        name: "get_resource",
        type: "read",
        description:
            "Get ONE SPECIFIC resource when the user provides a resource ID and is authorized to access the resource through its project.",
        parameters: {
            resource_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Authorized details for the specified resource, including its project, description, URL, uploader, and creation date."
    }
};

module.exports = tools;