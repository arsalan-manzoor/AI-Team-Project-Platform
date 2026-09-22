const { getAIContext } = require("../services/aiContext.service");
const tools = require("./toolRegistry");

async function executeTool(toolName, args, userId) {
    if (!tools[toolName]) {
        throw new Error("Unknown AI tool");
    }

    switch (toolName) {
        case "get_project":
            return getAIContext("project", args.project_id, userId);

        case "get_task":
            return getAIContext("task", args.task_id, userId);

        case "get_team_members":
            return getAIContext("team", args.team_id, userId);

        case "get_milestones":
            return getAIContext("milestone", args.milestone_id, userId);

        case "get_recent_activity":
            return getAIContext(
                "recent_activity",
                args.project_id,
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