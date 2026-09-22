const { getUserTaskContext } = require("./userTaskContext.service");
const { getTeamContext } = require("./teamContext.service");
const { getProjectContext } = require("./projectContext.service");
const { getTaskContext } = require("./taskContext.service");
const { getMilestoneContext } = require("./milestoneContext.service");
const { getRecentActivityContext } = require("./recentActivityContext.service");

async function getAIContext(type, id, userId) {
    switch (type) {
        case "user_tasks":
            return getUserTaskContext(userId);

        case "team":
            return getTeamContext(id, userId);

        case "project":
            return getProjectContext(id, userId);

        case "task":
            return getTaskContext(id, userId);

        case "milestone":
            return getMilestoneContext(id, userId);

        case "recent_activity":
            return getRecentActivityContext(id, userId);

        default:
            throw new Error("Invalid AI context type");
    }
}

module.exports = {
    getAIContext
};