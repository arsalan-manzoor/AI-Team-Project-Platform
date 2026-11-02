require("dotenv").config();

const pool = require("../src/config/db");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function main() {
    const userId = 1;

    const taskResult = await pool.query(
        `SELECT
            tasks.id,
            tasks.title,
            tasks.project_id
         FROM tasks
         JOIN projects
            ON tasks.project_id = projects.id
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY tasks.id
         LIMIT 1`,
        [userId]
    );

    if (taskResult.rows.length === 0) {
        throw new Error(
            "No authorized task found for test user"
        );
    }

    const task = taskResult.rows[0];

    const testComment =
        "Natural Language Test Comment";

    const commentsBeforeResult = await pool.query(
        `SELECT id
         FROM comments
         WHERE content = $1`,
        [testComment]
    );

    const commentsBefore =
        commentsBeforeResult.rows;

    const modelResponse = {
        tool_calls: [
            {
                name: "create_comment",
                arguments: {
                    content: testComment,
                    task_id: null,
                    project_id: null
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
                    `Add a comment "${testComment}" to the task "${task.title}"`
            }
        ],
        modelResponse
    });

    if (
        !result ||
        !result.requires_confirmation
    ) {
        throw new Error(
            "Expected create_comment to require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Expected a confirmation ID"
        );
    }

    if (
        result.tool_name !==
        "create_comment"
    ) {
        throw new Error(
            "Expected create_comment tool"
        );
    }

    if (
        result.tool_arguments.task_id !==
        task.id
    ) {
        throw new Error(
            `Expected task ID ${task.id}, received ${result.tool_arguments.task_id}`
        );
    }

    if (
        Number.isInteger(
            result.tool_arguments.project_id
        )
    ) {
        throw new Error(
            "Comment should target the task, not the project"
        );
    }

    if (
        result.tool_arguments.content !==
        testComment
    ) {
        throw new Error(
            "Comment content was not preserved correctly"
        );
    }

    const commentsAfterResult = await pool.query(
        `SELECT id
         FROM comments
         WHERE content = $1`,
        [testComment]
    );

    const commentsAfter =
        commentsAfterResult.rows;

    if (
        commentsAfter.length !==
        commentsBefore.length
    ) {
        throw new Error(
            "Comment was created before confirmation"
        );
    }

    console.log(
        "PASS: natural-language create_comment resolved task and requires confirmation"
    );

    console.log(
        `Resolved task: ${task.title} (ID ${task.id})`
    );

    console.log(
        "PASS: comment was not created before confirmation"
    );
}

main()
    .catch((error) => {
        console.error(
            "FAIL:",
            error.message
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });