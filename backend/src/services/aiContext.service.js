const { buildAIContextContract } = require("./aiContext.contract");
const { getUserTaskContext } = require("./userTaskContext.service");
const { getTeamContext } = require("./teamContext.service");
const { getProjectContext } = require("./projectContext.service");
const { getTaskContext } = require("./taskContext.service");
const { getMilestoneContext } = require("./milestoneContext.service");
const { getRecentActivityContext } = require("./recentActivityContext.service");

const MAX_CONTEXT_ITEMS = 100;

function limitContextItems(context) {
    if (!context || typeof context !== "object") {
        return context;
    }

    const limitedContext = { ...context };

    if (Array.isArray(limitedContext.tasks)) {
        limitedContext.tasks = limitedContext.tasks.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.members)) {
        limitedContext.members = limitedContext.members.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.projects)) {
        limitedContext.projects = limitedContext.projects.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.subtasks)) {
        limitedContext.subtasks = limitedContext.subtasks.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.comments)) {
        limitedContext.comments = limitedContext.comments.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.milestones)) {
        limitedContext.milestones = limitedContext.milestones.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.related_tasks)) {
        limitedContext.related_tasks = limitedContext.related_tasks.slice(0, MAX_CONTEXT_ITEMS);
    }

    if (Array.isArray(limitedContext.recent_activity)) {
        limitedContext.recent_activity =
            limitedContext.recent_activity.slice(0, MAX_CONTEXT_ITEMS);
    }

    return limitedContext;
}

async function getAIContext(type, id, userId) {
    let context;

    switch (type) {
        case "user_tasks":
            context = await getUserTaskContext(userId);
            break;

        case "team":
            context = await getTeamContext(id, userId);
            break;

        case "project":
            context = await getProjectContext(id, userId);
            break;

        case "task":
            context = await getTaskContext(id, userId);
            break;

        case "milestone":
            context = await getMilestoneContext(id, userId);
            break;

        case "recent_activity":
            context = await getRecentActivityContext(id, userId);
            break;

        default:
            throw new Error("Invalid AI context type");
    }

    return buildAIContextContract(type, limitContextItems(context));
}

module.exports = {
    getAIContext
};