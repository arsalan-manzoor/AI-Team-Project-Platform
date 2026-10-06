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
        baseUrl:
            `http://127.0.0.1:${address.port}`
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

    const createdTaskIds = [];

    try {
        const userId = 1;

        assert(
            process.env.JWT_SECRET,
            "JWT_SECRET must be configured"
        );

        const projectResult =
            await pool.query(
                `SELECT projects.id,
                        projects.name
                 FROM projects
                 JOIN team_members
                    ON projects.team_id =
                       team_members.team_id
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

        const firstTaskTitle =
            `Natural Language Bulk Task A ${Date.now()}`;

        const secondTaskTitle =
            `Natural Language Bulk Task B ${Date.now()}`;

        const firstTaskResult =
            await pool.query(
                `INSERT INTO tasks
                 (title,
                  description,
                  project_id,
                  assigned_to,
                  created_by,
                  status,
                  priority,
                  deadline)
                 VALUES
                 ($1, $2, $3, NULL, $4, $5, $6, NULL)
                 RETURNING id,
                           title,
                           status,
                           priority,
                           created_by,
                           project_id`,
                [
                    firstTaskTitle,
                    "Bulk update execution test task A",
                    project.id,
                    userId,
                    "pending",
                    "low"
                ]
            );

        const secondTaskResult =
            await pool.query(
                `INSERT INTO tasks
                 (title,
                  description,
                  project_id,
                  assigned_to,
                  created_by,
                  status,
                  priority,
                  deadline)
                 VALUES
                 ($1, $2, $3, NULL, $4, $5, $6, NULL)
                 RETURNING id,
                           title,
                           status,
                           priority,
                           created_by,
                           project_id`,
                [
                    secondTaskTitle,
                    "Bulk update execution test task B",
                    project.id,
                    userId,
                    "pending",
                    "low"
                ]
            );

        const firstTask =
            firstTaskResult.rows[0];

        const secondTask =
            secondTaskResult.rows[0];

        createdTaskIds.push(
            firstTask.id,
            secondTask.id
        );

        const taskIds = [
            Number(firstTask.id),
            Number(secondTask.id)
        ];

        const modelResponse = {
            tool_calls: [
                {
                    name: "bulk_update_tasks",
                    arguments: {
                        task_ids: taskIds,
                        status: "completed",
                        priority: "high"
                    }
                }
            ]
        };

        const result =
            await runAIRequest({
                userId,
                messages: [
                    {
                        role: "user",
                        content:
                            `Mark the tasks "${firstTaskTitle}" and "${secondTaskTitle}" in the project "${project.name}" as completed and set their priority to high.`
                    }
                ],
                modelResponse
            });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "bulk_update_tasks should require confirmation"
        );

        assert(
            result.confirmation_id,
            "confirmation_id should be returned"
        );

        assert.strictEqual(
            result.tool_name,
            "bulk_update_tasks",
            "AI should select bulk_update_tasks"
        );

        assert.deepStrictEqual(
            result.tool_arguments.task_ids
                .map(Number)
                .sort((a, b) => a - b),
            taskIds
                .slice()
                .sort((a, b) => a - b),
            "Task IDs should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.status,
            "completed",
            "Requested status should be completed"
        );

        assert.strictEqual(
            result.tool_arguments.priority,
            "high",
            "Requested priority should be high"
        );

        const beforeConfirmation =
            await pool.query(
                `SELECT id,
                        title,
                        status,
                        priority
                 FROM tasks
                 WHERE id = ANY($1::int[])
                 ORDER BY id`,
                [taskIds]
            );

        assert.strictEqual(
            beforeConfirmation.rows.length,
            2,
            "Both test tasks should exist before confirmation"
        );

        for (
            const task
            of beforeConfirmation.rows
        ) {
            assert.strictEqual(
                task.status,
                "pending",
                "Task status must remain unchanged before confirmation"
            );

            assert.strictEqual(
                task.priority,
                "low",
                "Task priority must remain unchanged before confirmation"
            );
        }

        console.log(
            "PASS: natural-language bulk_update_tasks resolved both tasks and requires confirmation"
        );

        console.log(
            `Resolved tasks: ${firstTaskTitle} (ID ${firstTask.id}), ${secondTaskTitle} (ID ${secondTask.id})`
        );

        const {
            server: testServer,
            baseUrl
        } = await startTestServer();

        server = testServer;

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token =
            jwt.sign(
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
            200,
            `Confirmation should return HTTP 200. Received ${response.status}: ${JSON.stringify(responseBody)}`
        );

        assert(
            Array.isArray(
                responseBody.tasks
            ),
            "Confirmation response should contain updated tasks"
        );

        assert.strictEqual(
            responseBody.tasks.length,
            2,
            "Confirmation response should contain both updated tasks"
        );

        for (
            const task
            of responseBody.tasks
        ) {
            assert.strictEqual(
                task.status,
                "completed",
                "Updated task status should be completed"
            );

            assert.strictEqual(
                task.priority,
                "high",
                "Updated task priority should be high"
            );

            assert.strictEqual(
                Number(task.created_by),
                Number(userId),
                "Updated task creator should match authenticated user"
            );

            assert.strictEqual(
                Number(task.project_id),
                Number(project.id),
                "Updated task project should match test project"
            );
        }

        const afterConfirmation =
            await pool.query(
                `SELECT id,
                        title,
                        status,
                        priority,
                        project_id,
                        created_by
                 FROM tasks
                 WHERE id = ANY($1::int[])
                 ORDER BY id`,
                [taskIds]
            );

        assert.strictEqual(
            afterConfirmation.rows.length,
            2,
            "Both updated tasks should exist in database"
        );

        for (
            const task
            of afterConfirmation.rows
        ) {
            assert.strictEqual(
                task.status,
                "completed"
            );

            assert.strictEqual(
                task.priority,
                "high"
            );

            assert.strictEqual(
                Number(task.project_id),
                Number(project.id)
            );

            assert.strictEqual(
                Number(task.created_by),
                Number(userId)
            );
        }

        console.log(
            "PASS: confirmation executed bulk_update_tasks successfully"
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
                 WHERE id = ANY($1::int[])
                   AND created_by = $2
                 RETURNING id`,
                [
                    taskIds,
                    userId
                ]
            );

        assert.strictEqual(
            cleanupResult.rows.length,
            2,
            "Both test tasks should be cleaned up"
        );

        createdTaskIds.length = 0;

        console.log(
            "PASS: test tasks cleaned up"
        );

        await stopTestServer(server);

        server = null;

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language bulk_update_tasks execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language bulk_update_tasks execution test failed:"
        );

        console.error(error);

        if (createdTaskIds.length > 0) {
            try {
                await pool.query(
                    `DELETE FROM tasks
                     WHERE id = ANY($1::int[])`,
                    [createdTaskIds]
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