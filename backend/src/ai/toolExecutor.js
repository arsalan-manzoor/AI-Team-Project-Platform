const { getAIContext } = require("../services/aiContext.service");
const { getProjectListContext } = require("../services/projectListContext.service");
const { getTaskListContext } = require("../services/taskListContext.service");
const { getNotificationContext } = require("../services/notificationContext.service");
const {
    getProjectSummaryContext
} = require("../services/projectSummaryContext.service");
const tools = require("./toolRegistry");

function validateUserId(userId) {
    if (!Number.isInteger(userId)) {
        throw new Error("Authenticated user ID must be a valid integer");
    }
}

function validateToolArguments(tool, args) {
    const parameters = tool.parameters || {};
    const providedArgs = args || {};

    for (const [parameterName, parameterDefinition] of Object.entries(parameters)) {
        if (
            parameterDefinition.required &&
            providedArgs[parameterName] === undefined
        ) {
            throw new Error(
                `Missing required AI tool argument: ${parameterName}`
            );
        }

        if (providedArgs[parameterName] === undefined) {
            continue;
        }

        if (
            parameterDefinition.type === "integer" &&
            !Number.isInteger(providedArgs[parameterName])
        ) {
            throw new Error(
                `AI tool argument "${parameterName}" must be a valid integer`
            );
        }
    }
}

async function executeTool(toolName, args, userId) {
    const tool = tools[toolName];

    if (!tool) {
        throw new Error("Unknown AI tool");
    }

    validateUserId(userId);
    validateToolArguments(tool, args);

    const toolArgs = args || {};

    switch (toolName) {
        case "get_projects":
            return getProjectListContext(userId);

        case "get_project":
            return getAIContext(
                "project",
                toolArgs.project_id,
                userId
            );

        case "get_tasks":
            return getTaskListContext(userId);

        case "get_task":
            return getAIContext(
                "task",
                toolArgs.task_id,
                userId
            );

        case "get_team_members":
            return getAIContext(
                "team",
                toolArgs.team_id,
                userId
            );

        case "get_milestones":
            return getAIContext(
                "milestone",
                toolArgs.milestone_id,
                userId
            );

        case "get_notifications":
            return getNotificationContext(userId);

        case "get_recent_activity":
            return getAIContext(
                "recent_activity",
                toolArgs.project_id,
                userId
            );

        case "get_project_summary_data":
            return getProjectSummaryContext(
                toolArgs.project_id,
                userId
            );

        default:
            throw new Error(
                `AI tool "${toolName}" is registered but not implemented yet`
            );
    }
}

module.exports = {
    executeTool
};