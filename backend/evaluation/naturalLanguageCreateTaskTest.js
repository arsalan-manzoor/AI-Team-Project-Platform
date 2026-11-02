require("dotenv").config();

const pool = require("../src/config/db");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function main() {
    const userId = 1;

    const projectResult = await pool.query(
        `SELECT
            projects.id,
            projects.name
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY projects.id
         LIMIT 1`,
        [userId]
    );

    if (projectResult.rows.length === 0) {
        throw new Error(
            "No authorized project found for test user"
        );
    }

    const project = projectResult.rows[0];

    const testTaskTitle =
        "Natural Language Task Creation Test";

    const tasksBeforeResult = await pool.query(
        `SELECT id
         FROM tasks
         WHERE title = $1`,
        [testTaskTitle]
    );

    const tasksBefore =
        tasksBeforeResult.rows;

    const modelResponse = {
        tool_calls: [
            {
                name: "create_task",
                arguments: {
                    project_id: project.id,
                    title: testTaskTitle
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
                    `Create a task "${testTaskTitle}" in the project "${project.name}"`
            }
        ],
        modelResponse
    });

    if (
        !result ||
        !result.requires_confirmation
    ) {
        throw new Error(
            "Expected create_task to require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Expected a confirmation ID"
        );
    }

    if (
        result.tool_arguments.project_id !==
        project.id
    ) {
        throw new Error(
            `Expected project ID ${project.id}, received ${result.tool_arguments.project_id}`
        );
    }

    if (
        result.tool_arguments.title !==
        testTaskTitle
    ) {
        throw new Error(
            "Expected task title to be preserved"
        );
    }

    const tasksAfterResult = await pool.query(
        `SELECT id
         FROM tasks
         WHERE title = $1`,
        [testTaskTitle]
    );

    const tasksAfter =
        tasksAfterResult.rows;

    if (
        tasksAfter.length !==
        tasksBefore.length
    ) {
        throw new Error(
            "Task was created before confirmation"
        );
    }

    console.log(
        "PASS: natural-language create_task resolved project and requires confirmation"
    );

    console.log(
        `Resolved project: ${project.name} (ID ${project.id})`
    );

    console.log(
        "PASS: task was not created before confirmation"
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