require("dotenv").config();

const pool = require("../src/config/db");

const {
    createConfirmation,
    getConfirmation
} = require("../src/services/aiConfirmation.service");

const {
    createComment
} = require("../src/services/comment.service");

async function run() {
    const userId = 1;
    const taskId = 2;

    let confirmation = null;
    let comment = null;

    try {
        confirmation =
            createConfirmation({
                userId,
                conversationId:
                    "comment-test",
                toolName:
                    "create_comment",
                toolArguments: {
                    content:
                        "AI comment confirmation test",
                    task_id:
                        taskId
                }
            });

        console.log(
            "Confirmation created:",
            confirmation.confirmationId
        );

        const pending =
            getConfirmation(
                confirmation.confirmationId,
                userId
            );

        if (!pending) {
            throw new Error(
                "Confirmation could not be retrieved"
            );
        }

        if (
            pending.toolName !==
            "create_comment"
        ) {
            throw new Error(
                "Wrong confirmation tool name"
            );
        }

        comment =
            await createComment({
                content:
                    pending.toolArguments
                        .content,
                taskId:
                    pending.toolArguments
                        .task_id,
                projectId:
                    pending.toolArguments
                        .project_id,
                userId
            });

        if (!comment.id) {
            throw new Error(
                "Comment was not created"
            );
        }

        console.log(
            "Comment created:",
            comment
        );

        const commentResult =
            await pool.query(
                `SELECT id,
                        content,
                        user_id,
                        task_id,
                        project_id
                 FROM comments
                 WHERE id = $1`,
                [comment.id]
            );

        if (
            commentResult.rows.length !== 1
        ) {
            throw new Error(
                "Created comment was not found in database"
            );
        }

        if (
            commentResult.rows[0]
                .content !==
            "AI comment confirmation test"
        ) {
            throw new Error(
                "Comment content does not match"
            );
        }

        if (
            commentResult.rows[0]
                .user_id !== userId
        ) {
            throw new Error(
                "Comment user ID does not match"
            );
        }

        if (
            commentResult.rows[0]
                .task_id !== taskId
        ) {
            throw new Error(
                "Comment task ID does not match"
            );
        }

        console.log(
            "Database verification passed"
        );

        const confirmationAfter =
            getConfirmation(
                confirmation.confirmationId,
                userId
            );

        if (!confirmationAfter) {
            console.log(
                "Confirmation was already consumed by the service flow"
            );
        } else {
            console.log(
                "Confirmation still exists because this direct service test does not consume it through the HTTP route"
            );
        }

        await pool.query(
            `DELETE FROM comments
             WHERE id = $1`,
            [comment.id]
        );

        console.log(
            "Test comment cleaned up"
        );

        console.log(
            "create_comment service test passed"
        );
    } catch (error) {
        console.error(
            "create_comment test failed:",
            error.message
        );

        if (comment && comment.id) {
            await pool.query(
                `DELETE FROM comments
                 WHERE id = $1`,
                [comment.id]
            );
        }

        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();