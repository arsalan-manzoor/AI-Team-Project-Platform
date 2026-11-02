const {
    getProjectSummaryContext
} = require("./projectSummaryContext.service");

const DUE_SOON_DAYS = 7;

function calculateDeadlineIntelligence(
    projectContext,
    referenceDate = new Date()
) {
    const tasks = Array.isArray(projectContext?.tasks)
        ? projectContext.tasks
        : [];

    const now = new Date(referenceDate);

    const tasksWithDeadlines = tasks.filter(
        (task) => task.deadline !== null && task.deadline !== undefined
    );

    const overdueTasks = tasksWithDeadlines.filter(
        (task) => new Date(task.deadline) < now
    );

    const dueSoonLimit = new Date(now);
    dueSoonLimit.setDate(
        dueSoonLimit.getDate() + DUE_SOON_DAYS
    );

    const tasksDueSoon = tasksWithDeadlines.filter(
        (task) => {
            const deadline = new Date(task.deadline);

            return (
                deadline >= now &&
                deadline <= dueSoonLimit
            );
        }
    );

    const totalTasks = tasks.length;
    const tasksWithoutDeadlines =
        totalTasks - tasksWithDeadlines.length;

    const deadlineCoveragePercentage =
        totalTasks === 0
            ? 0
            : Number(
                (
                    (tasksWithDeadlines.length / totalTasks) *
                    100
                ).toFixed(2)
            );

    return {
        total_tasks: totalTasks,
        tasks_with_deadlines: tasksWithDeadlines.length,
        tasks_without_deadlines: tasksWithoutDeadlines,
        overdue_tasks: overdueTasks.length,
        tasks_due_soon: tasksDueSoon.length,
        deadline_coverage_percentage:
            deadlineCoveragePercentage
    };
}

async function getProjectIntelligence(
    projectId,
    userId,
    referenceDate = new Date()
) {
    const context = await getProjectSummaryContext(
        projectId,
        userId
    );

    if (!context.available) {
        return {
            context_type: "project_intelligence",
            data: null,
            available: false,
            message:
                "No authorized context is available for this request."
        };
    }

    return {
        context_type: "project_intelligence",
        data: {
            project: context.data.project,
            intelligence: calculateDeadlineIntelligence(
                context.data,
                referenceDate
            )
        },
        available: true
    };
}

module.exports = {
    DUE_SOON_DAYS,
    calculateDeadlineIntelligence,
    getProjectIntelligence
};