require("dotenv").config();

const pool = require("../src/config/db");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function main() {
    const userId = 1;
    const taskId = 2;
    const updatedTitle =
        "Natural Language Task Update Test";

    const taskBeforeResult = await pool.query(
        `SELECT
            tasks.id,
            tasks.title,
            tasks.description,
            tasks.project_id
         FROM tasks
         JOIN projects
            ON tasks.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE tasks.id = $1
           AND team_members.user_id = $2`,
        [taskId, userId]
    );

    if (taskBeforeResult.rows.length === 0) {
        throw new Error(
            "Authorized task not found for test user"
        );
    }

    const taskBefore =
        taskBeforeResult.rows[0];

    const modelResponse = {
        tool_calls: [
            {
                name: "update_task",
                arguments: {
                    task_id: taskId,
                    title: updatedTitle
                }
            }
        ]
    };

    const result = await runAIRequest({
        userId,
        messages: [
            {
                role: "user",
                content:
                    `Update task "${taskBefore.title}" to "${updatedTitle}"`
            }
        ],
        modelResponse
    });

    if (
        !result ||
        !result.requires_confirmation
    ) {
        throw new Error(
            "Expected update_task to require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Expected a confirmation ID"
        );
    }

    if (
        result.tool_arguments.task_id !==
        taskId
    ) {
        throw new Error(
            `Expected task ID ${taskId}, received ${result.tool_arguments.task_id}`
        );
    }

    if (
        result.tool_arguments.title !==
        updatedTitle
    ) {
        throw new Error(
            "Expected updated task title to be preserved"
        );
    }

    const taskAfterResult = await pool.query(
        `SELECT
            id,
            title
         FROM tasks
         WHERE id = $1`,
        [taskId]
    );

    if (taskAfterResult.rows.length === 0) {
        throw new Error(
            "Task disappeared before confirmation"
        );
    }

    const taskAfter =
        taskAfterResult.rows[0];

    if (
        taskAfter.title !==
        taskBefore.title
    ) {
        throw new Error(
            "Task was updated before confirmation"
        );
    }

    console.log(
        "PASS: natural-language update_task resolved task and requires confirmation"
    );

    console.log(
        `Resolved task: ${taskBefore.title} (ID ${taskId})`
    );

    console.log(
        "PASS: task was not updated before confirmation"
    );
}

main()
    .catch((error) => {
        console.error(
            `FAIL: ${error.message}`
        );
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });