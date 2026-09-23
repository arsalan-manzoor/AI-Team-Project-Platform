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
    }
];

module.exports = readOnlyToolCases;