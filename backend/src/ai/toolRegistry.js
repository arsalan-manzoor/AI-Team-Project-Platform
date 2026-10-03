const toolRegistry = {
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
            "The requested project if the authenticated user is authorized to access it."
    },

    get_tasks: {
        name: "get_tasks",
        type: "read",
        description:
            "Get tasks the authenticated user is authorized to access. If a project ID is provided, return tasks from that specific authorized project. If no project ID is provided, return the authenticated user's authorized tasks.",
        parameters: {
            project_id: {
                type: "integer",
                required: false
            }
        },
        returns:
            "Tasks authorized for the authenticated user, optionally filtered by project."
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
            "The requested task if the authenticated user is authorized to access it."
    },

    get_team_members: {
        name: "get_team_members",
        type: "read",
        description:
            "Get members of ONE SPECIFIC team when the user provides a team ID.",
        parameters: {
            team_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Members of the requested authorized team."
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
            "The requested milestone if the authenticated user is authorized to access it."
    },

    get_notifications: {
        name: "get_notifications",
        type: "read",
        description:
            "Get notifications belonging to the authenticated user.",
        parameters: {},
        returns:
            "Notifications belonging to the authenticated user."
    },

    get_recent_activity: {
        name: "get_recent_activity",
        type: "read",
        description:
            "Get recent activity for ONE SPECIFIC project when the user provides a project ID.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "Recent activity from the requested authorized project."
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
            "Structured summary data for the requested authorized project."
    },

    get_resource: {
        name: "get_resource",
        type: "read",
        description:
            "Get ONE SPECIFIC resource when the user provides a resource ID.",
        parameters: {
            resource_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "The requested resource if the authenticated user is authorized to access it."
    },

    create_task: {
        name: "create_task",
        type: "write",
        description:
            "Create ONE new task inside an authorized project when the user explicitly asks to create a task. Creating a task requires explicit confirmation before execution.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            },
            title: {
                type: "string",
                required: true
            },
            description: {
                type: "string",
                required: false
            },
            assigned_to: {
                type: "integer",
                required: false
            },
            status: {
                type: "string",
                required: false
            },
            priority: {
                type: "string",
                required: false
            },
            deadline: {
                type: "string",
                required: false
            }
        },
        returns:
            "The created task after authorization and database validation."
    },

    update_task: {
        name: "update_task",
        type: "write",
        description:
            "Update ONE existing task when the user explicitly asks to change a task. The task must be identified by task ID. Updating a task requires explicit confirmation before execution.",
        parameters: {
            task_id: {
                type: "integer",
                required: true
            },
            title: {
                type: "string",
                required: true
            },
            description: {
                type: "string",
                required: false
            },
            assigned_to: {
                type: "integer",
                required: false
            },
            status: {
                type: "string",
                required: false
            },
            priority: {
                type: "string",
                required: false
            },
            deadline: {
                type: "string",
                required: false
            }
        },
        returns:
            "The updated task after authorization and database validation."
    },

    create_project: {
        name: "create_project",
        type: "write",
        description:
            "Create ONE new project inside a team when the user explicitly asks to create a project. The authenticated user must be a member of the team. Creating a project requires explicit confirmation before execution.",
        parameters: {
            name: {
                type: "string",
                required: true
            },
            description: {
                type: "string",
                required: false
            },
            team_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "The created project after team membership validation."
    },

    update_project: {
        name: "update_project",
        type: "write",
        description:
            "Update ONE existing project when the user explicitly asks to change a project's name or description. The project must be identified by project ID, and the authenticated user must be the project creator. Updating a project requires explicit confirmation before execution.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            },
            name: {
                type: "string",
                required: true
            },
            description: {
                type: "string",
                required: false
            }
        },
        returns:
            "The updated project after creator authorization and database validation."
    },

    create_milestone: {
        name: "create_milestone",
        type: "write",
        description:
            "Create ONE new milestone inside a project when the user explicitly asks to create a milestone. The authenticated user must be a member of the project's team. Creating a milestone requires explicit confirmation before execution.",
        parameters: {
            name: {
                type: "string",
                required: true
            },
            description: {
                type: "string",
                required: false
            },
            project_id: {
                type: "integer",
                required: true
            },
            deadline: {
                type: "string",
                required: false
            },
            status: {
                type: "string",
                required: false
            }
        },
        returns:
            "The created milestone after project membership validation."
    },

    create_comment: {
        name: "create_comment",
        type: "write",
        description:
            "Create ONE comment on an authorized task or project when the user explicitly asks to add or post a comment. The comment must contain text and must target either a task or a project. Creating a comment requires explicit confirmation before execution.",
        parameters: {
            content: {
                type: "string",
                required: true
            },
            task_id: {
                type: "integer",
                required: false
            },
            project_id: {
                type: "integer",
                required: false
            }
        },
        returns:
            "The created comment after authorization and database validation."
    },

    delete_task: {
        name: "delete_task",
        type: "write",
        description:
            "Delete ONE existing task when the user explicitly asks to delete a task. The task must be identified by task ID, and the authenticated user must be the task creator. Deleting a task requires explicit confirmation before execution.",
        parameters: {
            task_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "The deleted task after authorization and database validation."
    },

    delete_project: {
        name: "delete_project",
        type: "write",
        description:
            "Delete ONE existing project when the user explicitly asks to delete a project. The project must be identified by project ID, and the authenticated user must be the project creator. Deleting a project requires explicit confirmation before execution.",
        parameters: {
            project_id: {
                type: "integer",
                required: true
            }
        },
        returns:
            "The deleted project after authorization and database validation."
    },

    bulk_update_tasks: {
        name: "bulk_update_tasks",
        type: "write",
        description:
            "Update MULTIPLE existing tasks with the same requested changes when the user explicitly asks to bulk update tasks. Each task must be identified by task ID. The authenticated user must be authorized to update every selected task. This is a sensitive action and requires explicit confirmation before execution.",
        parameters: {
            task_ids: {
                type: "array",
                required: true,
                items: {
                    type: "integer"
                }
            },
            status: {
                type: "string",
                required: false
            },
            priority: {
                type: "string",
                required: false
            },
            assigned_to: {
                type: "integer",
                required: false
            },
            deadline: {
                type: "string",
                required: false
            }
        },
        returns:
            "The updated tasks after authorization and database validation."
    }
};

module.exports = toolRegistry;