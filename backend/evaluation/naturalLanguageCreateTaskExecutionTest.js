require("dotenv").config();

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const app = require("../src/app");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function startTestServer() {
    const server = http.createServer(app);

    await new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
            resolve();
        });

        server.on("error", reject);
    });

    const address = server.address();

    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
    };
}

async function stopTestServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function main() {
    let server;
    let createdTaskId = null;

    try {
        const userId = 1;

        assert(
            process.env.JWT_SECRET,
            "JWT_SECRET must be configured"
        );

        const projectResult = await pool.query(
            `SELECT projects.id,
                    projects.name
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE team_members.user_id = $1
             ORDER BY projects.id
             LIMIT 1`,
            [userId]
        );

        assert(
            projectResult.rows.length > 0,
            "No authorized project found for test user"
        );

        const project =
            projectResult.rows[0];

        const testTitle =
            `Natural Language Test Task ${Date.now()}`;

        const testDescription =
            "Created through natural-language AI confirmation test";

        const modelResponse = {
            tool_calls: [
                {
                    name: "create_task",
                    arguments: {
                        title: testTitle,
                        description: testDescription,
                        project_id: project.id,
                        assigned_to: null,
                        status: "pending",
                        priority: "medium",
                        deadline: null
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
                        `Create a task "${testTitle}" in the project "${project.name}" with description "${testDescription}".`
                }
            ],
            modelResponse
        });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "create_task should require confirmation"
        );

        assert(
            result.confirmation_id,
            "confirmation_id should be returned"
        );

        assert.strictEqual(
            result.tool_name,
            "create_task",
            "AI should select create_task"
        );

        assert.strictEqual(
            Number(result.tool_arguments.project_id),
            Number(project.id),
            "Project ID should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.title,
            testTitle,
            "Task title should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.description,
            testDescription,
            "Task description should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.assigned_to,
            null,
            "assigned_to should remain null"
        );

        assert.strictEqual(
            result.tool_arguments.status,
            "pending",
            "Default status should be pending"
        );

        assert.strictEqual(
            result.tool_arguments.priority,
            "medium",
            "Default priority should be medium"
        );

        const beforeConfirmation =
            await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE title = $1
                   AND project_id = $2`,
                [
                    testTitle,
                    project.id
                ]
            );

        assert.strictEqual(
            beforeConfirmation.rows.length,
            0,
            "Task must not be created before confirmation"
        );

        console.log(
            "PASS: natural-language create_task resolved project and requires confirmation"
        );

        console.log(
            `Resolved project: ${project.name} (ID ${project.id})`
        );

        const {
            server: testServer,
            baseUrl
        } = await startTestServer();

        server = testServer;

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token = jwt.sign(
            {
                id: userId
            },
            process.env.JWT_SECRET
        );

        const response =
            await fetch(
                `${baseUrl}/api/ai/confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        confirmationId:
                            result.confirmation_id
                    })
                }
            );

        const responseBody =
            await response.json();

        assert.strictEqual(
            response.status,
            201,
            `Confirmation should return HTTP 201. Received ${response.status}: ${JSON.stringify(responseBody)}`
        );

        assert(
            responseBody.task,
            "Confirmation response should contain created task"
        );

        createdTaskId =
            responseBody.task.id;

        assert.strictEqual(
            responseBody.task.title,
            testTitle,
            "Created task title should match"
        );

        assert.strictEqual(
            Number(responseBody.task.project_id),
            Number(project.id),
            "Created task project should match"
        );

        assert.strictEqual(
            Number(responseBody.task.created_by),
            Number(userId),
            "Created task creator should match authenticated user"
        );

        assert.strictEqual(
            responseBody.task.description,
            testDescription,
            "Created task description should match"
        );

        const afterConfirmation =
            await pool.query(
                `SELECT id,
                        title,
                        description,
                        project_id,
                        assigned_to,
                        created_by,
                        status,
                        priority
                 FROM tasks
                 WHERE id = $1`,
                [createdTaskId]
            );

        assert.strictEqual(
            afterConfirmation.rows.length,
            1,
            "Created task should exist in database"
        );

        const createdTask =
            afterConfirmation.rows[0];

        assert.strictEqual(
            createdTask.title,
            testTitle
        );

        assert.strictEqual(
            createdTask.description,
            testDescription
        );

        assert.strictEqual(
            Number(createdTask.project_id),
            Number(project.id)
        );

        assert.strictEqual(
            createdTask.assigned_to,
            null
        );

        assert.strictEqual(
            Number(createdTask.created_by),
            Number(userId)
        );

        assert.strictEqual(
            createdTask.status,
            "pending"
        );

        assert.strictEqual(
            createdTask.priority,
            "medium"
        );

        console.log(
            `PASS: confirmation executed create_task successfully (task ID ${createdTaskId})`
        );

        const reuseResponse =
            await fetch(
                `${baseUrl}/api/ai/confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        confirmationId:
                            result.confirmation_id
                    })
                }
            );

        const reuseBody =
            await reuseResponse.json();

        assert.strictEqual(
            reuseResponse.status,
            404,
            "Confirmation must not be reusable"
        );

        console.log(
            "PASS: confirmation cannot be reused"
        );

        const cleanupResult =
            await pool.query(
                `DELETE FROM tasks
                 WHERE id = $1
                   AND created_by = $2
                 RETURNING id`,
                [
                    createdTaskId,
                    userId
                ]
            );

        assert.strictEqual(
            cleanupResult.rows.length,
            1,
            "Test task should be cleaned up"
        );

        createdTaskId = null;

        console.log(
            "PASS: test task cleaned up"
        );

        await stopTestServer(server);
        server = null;

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language create_task execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language create_task execution test failed:"
        );

        console.error(error);

        if (createdTaskId !== null) {
            try {
                await pool.query(
                    `DELETE FROM tasks
                     WHERE id = $1`,
                    [createdTaskId]
                );
            } catch (cleanupError) {
                console.error(
                    "Cleanup error:",
                    cleanupError
                );
            }
        }

        process.exitCode = 1;
    } finally {
        if (server) {
            try {
                await stopTestServer(server);
            } catch (error) {
                console.error(
                    "Server shutdown error:",
                    error
                );
            }
        }

        await pool.end();
    }
}

main();