require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const app = require("../src/app");

const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function requestJson(
    baseUrl,
    path,
    method,
    body,
    token = null
) {
    const response = await fetch(
        `${baseUrl}${path}`,
        {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(token
                    ? {
                          Authorization: `Bearer ${token}`
                      }
                    : {})
            },
            body:
                body === undefined
                    ? undefined
                    : JSON.stringify(body)
        }
    );

    const text = await response.text();

    let parsedBody;

    try {
        parsedBody = JSON.parse(text);
    } catch (error) {
        parsedBody = text;
    }

    return {
        status: response.status,
        body: parsedBody
    };
}

async function run() {
    const userId = 1;

    const testComment =
        `Natural Language Comment Execution Test ${Date.now()}`;

    let server = null;
    let baseUrl = null;
    let createdCommentId = null;

    try {
        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET is not configured in .env"
            );
        }

        server = http.createServer(app);

        await new Promise(
            (resolve, reject) => {
                server.once(
                    "error",
                    reject
                );

                server.listen(
                    0,
                    "127.0.0.1",
                    resolve
                );
            }
        );

        const address =
            server.address();

        baseUrl =
            `http://127.0.0.1:${address.port}`;

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token =
            jwt.sign(
                {
                    id: userId
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "10m"
                }
            );

        console.log(
            `PASS: Test authentication token created for user ${userId}`
        );

        console.log(
            "\nFinding an authorized task..."
        );

        const taskResult =
            await pool.query(
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

        if (
            taskResult.rows.length === 0
        ) {
            throw new Error(
                "No authorized task found for test user"
            );
        }

        const task =
            taskResult.rows[0];

        console.log(
            `PASS: Authorized task found: ${task.title} (ID ${task.id})`
        );

        console.log(
            "\nRunning natural-language create_comment through the orchestrator..."
        );

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

        const aiResult =
            await runAIRequest({
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

        console.log(
            "AI result:",
            JSON.stringify(
                aiResult,
                null,
                2
            )
        );

        if (
            !aiResult ||
            aiResult.requires_confirmation !==
                true
        ) {
            throw new Error(
                "Expected create_comment to require confirmation"
            );
        }

        console.log(
            "PASS: Confirmation was required"
        );

        if (
            aiResult.tool_name !==
            "create_comment"
        ) {
            throw new Error(
                `Expected create_comment, received ${aiResult.tool_name}`
            );
        }

        console.log(
            "PASS: create_comment was selected"
        );

        const confirmationId =
            aiResult.confirmation_id;

        if (!confirmationId) {
            throw new Error(
                "Expected a confirmation ID"
            );
        }

        console.log(
            `PASS: Confirmation ID received: ${confirmationId}`
        );

        if (
            aiResult.tool_arguments?.task_id !==
            task.id
        ) {
            throw new Error(
                `Expected task ID ${task.id}, but received ${aiResult.tool_arguments?.task_id}`
            );
        }

        console.log(
            "PASS: Correct task ID was resolved"
        );

        if (
            aiResult.tool_arguments?.content !==
            testComment
        ) {
            throw new Error(
                "Comment content was not preserved correctly"
            );
        }

        console.log(
            "PASS: Correct comment content was prepared"
        );

        console.log(
            "\nChecking database before confirmation..."
        );

        const beforeConfirmationResult =
            await pool.query(
                `SELECT id
                 FROM comments
                 WHERE content = $1`,
                [testComment]
            );

        if (
            beforeConfirmationResult.rows.length !==
            0
        ) {
            throw new Error(
                "Comment was created before confirmation"
            );
        }

        console.log(
            "PASS: Comment was not created before confirmation"
        );

        console.log(
            "\nConfirming create_comment through API..."
        );

        const confirmationResponse =
            await requestJson(
                baseUrl,
                "/api/ai/confirm",
                "POST",
                {
                    confirmationId
                },
                token
            );

        console.log(
            `Confirmation HTTP status: ${confirmationResponse.status}`
        );

        console.log(
            "Confirmation response:",
            JSON.stringify(
                confirmationResponse.body,
                null,
                2
            )
        );

        if (
            confirmationResponse.status !== 201
        ) {
            throw new Error(
                `Confirmation failed with HTTP ${confirmationResponse.status}: ${JSON.stringify(confirmationResponse.body)}`
            );
        }

        console.log(
            "PASS: create_comment confirmation executed successfully"
        );

        console.log(
            "\nChecking database after confirmation..."
        );

        const afterConfirmationResult =
            await pool.query(
                `SELECT
                    id,
                    content,
                    task_id,
                    project_id
                 FROM comments
                 WHERE content = $1`,
                [testComment]
            );

        if (
            afterConfirmationResult.rows.length !==
            1
        ) {
            throw new Error(
                `Expected exactly one created comment, found ${afterConfirmationResult.rows.length}`
            );
        }

        const createdComment =
            afterConfirmationResult.rows[0];

        createdCommentId =
            createdComment.id;

        console.log(
            `Created comment ID: ${createdCommentId}`
        );

        if (
            createdComment.content !==
            testComment
        ) {
            throw new Error(
                "Database comment content is incorrect"
            );
        }

        if (
            createdComment.task_id !==
            task.id
        ) {
            throw new Error(
                `Expected task_id ${task.id}, but database contains ${createdComment.task_id}`
            );
        }

        if (
            createdComment.project_id !==
            null
        ) {
            throw new Error(
                "Comment should target the task, not the project"
            );
        }

        console.log(
            "PASS: Comment was created correctly after confirmation"
        );

        console.log(
            "\nChecking that confirmation cannot be reused..."
        );

        const reuseResponse =
            await requestJson(
                baseUrl,
                "/api/ai/confirm",
                "POST",
                {
                    confirmationId
                },
                token
            );

        console.log(
            `Reuse HTTP status: ${reuseResponse.status}`
        );

        console.log(
            "Reuse response:",
            JSON.stringify(
                reuseResponse.body,
                null,
                2
            )
        );

        if (
            reuseResponse.status === 200
        ) {
            throw new Error(
                "Confirmation was incorrectly reusable"
            );
        }

        console.log(
            "PASS: Confirmation was consumed and cannot be reused"
        );

        console.log(
            "\nNatural-language create_comment execution test passed."
        );
    } finally {
        if (
            createdCommentId !== null
        ) {
            await pool.query(
                `DELETE FROM comments
                 WHERE id = $1`,
                [createdCommentId]
            );

            console.log(
                "Test comment cleaned up."
            );
        }

        if (server) {
            await new Promise(
                (resolve, reject) => {
                    server.close(
                        (error) => {
                            if (error) {
                                reject(error);
                                return;
                            }

                            resolve();
                        }
                    );
                }
            );

            console.log(
                "Test API server stopped."
            );
        }
    }
}

run()
    .catch((error) => {
        console.error(
            "\nNatural-language create_comment execution test failed."
        );

        console.error(
            "Error:",
            error
        );

        console.error(
            "Error message:",
            error?.message ||
                "(no error message)"
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });