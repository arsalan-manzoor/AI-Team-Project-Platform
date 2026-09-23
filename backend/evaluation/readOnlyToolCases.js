const readOnlyToolCases = [
    {
        name: "authorized_project_access",
        tool: "get_project",
        user_id: 6,
        arguments: {
            project_id: 2
        },
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "unauthorized_project_access",
        tool: "get_project",
        user_id: 6,
        arguments: {
            project_id: 1
        },
        expected: {
            should_execute: true,
            should_return_data: false
        }
    },

    {
        name: "missing_required_project_id",
        tool: "get_project",
        user_id: 6,
        arguments: {},
        expected: {
            should_execute: false,
            error: "Missing required AI tool argument: project_id"
        }
    },

    {
        name: "invalid_user_id",
        tool: "get_projects",
        user_id: null,
        arguments: {},
        expected: {
            should_execute: false,
            error: "Authenticated user ID must be a valid integer"
        }
    },

    {
        name: "authorized_task_list",
        tool: "get_tasks",
        user_id: 6,
        arguments: {},
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "authorized_notification_list",
        tool: "get_notifications",
        user_id: 6,
        arguments: {},
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "authorized_project_summary",
        tool: "get_project_summary_data",
        user_id: 6,
        arguments: {
            project_id: 2
        },
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "unauthorized_project_summary",
        tool: "get_project_summary_data",
        user_id: 6,
        arguments: {
            project_id: 999999
        },
        expected: {
            should_execute: true,
            should_return_data: false
        }
    },

    {
        name: "missing_required_summary_project_id",
        tool: "get_project_summary_data",
        user_id: 6,
        arguments: {},
        expected: {
            should_execute: false,
            error: "Missing required AI tool argument: project_id"
        }
    },

    {
        name: "authorized_task_access",
        tool: "get_task",
        user_id: 6,
        arguments: {
            task_id: 2
        },
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "authorized_team_members_access",
        tool: "get_team_members",
        user_id: 6,
        arguments: {
            team_id: 2
        },
        expected: {
            should_execute: true,
            should_return_data: true
        }
    },

    {
        name: "missing_milestone_access",
        tool: "get_milestones",
        user_id: 6,
        arguments: {
            milestone_id: 999999
        },
        expected: {
            should_execute: true,
            should_return_data: false
        }
    },

    {
        name: "authorized_recent_activity",
        tool: "get_recent_activity",
        user_id: 6,
        arguments: {
            project_id: 2
        },
        expected: {
            should_execute: true,
            should_return_data: true
        }
    }
];

module.exports = readOnlyToolCases;