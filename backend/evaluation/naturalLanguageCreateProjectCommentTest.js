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

    const testComment =
        "Natural Language Project Comment Test";

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
                    `Add a comment "${testComment}" to the project "${project.name}"`
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
        result.tool_arguments.project_id !==
        project.id
    ) {
        throw new Error(
            `Expected project ID ${project.id}, received ${result.tool_arguments.project_id}`
        );
    }

    if (
        Number.isInteger(
            result.tool_arguments.task_id
        )
    ) {
        throw new Error(
            "Comment should target the project, not a task"
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
        "PASS: natural-language create_comment resolved project and requires confirmation"
    );

    console.log(
        `Resolved project: ${project.name} (ID ${project.id})`
    );

    console.log(
        "PASS: project comment was not created before confirmation"
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