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
    let testTaskId = null;

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
            `Natural Language Delete Test Task ${Date.now()}`;

        const taskResult = await pool.query(
            `INSERT INTO tasks
             (title, description, project_id, created_by,
              status, priority)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, title, project_id, created_by`,
            [
                testTitle,
                "Temporary task for natural-language delete test",
                project.id,
                userId,
                "pending",
                "medium"
            ]
        );

        assert.strictEqual(
            taskResult.rows.length,
            1,
            "Test task should be created"
        );

        testTaskId =
            taskResult.rows[0].id;

        console.log(
            `Created temporary task: ${testTitle} (ID ${testTaskId})`
        );

        const modelResponse = {
            tool_calls: [
                {
                    name: "delete_task",
                    arguments: {
                        task_id: null
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
                        `Delete the task "${testTitle}".`
                }
            ],
            modelResponse
        });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "delete_task should require confirmation"
        );

        assert(
            result.confirmation_id,
            "confirmation_id should be returned"
        );

        assert.strictEqual(
            result.tool_name,
            "delete_task",
            "AI should select delete_task"
        );

        assert.strictEqual(
            Number(result.tool_arguments.task_id),
            Number(testTaskId),
            "Task ID should be resolved correctly"
        );

        const beforeConfirmation =
            await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE id = $1`,
                [testTaskId]
            );

        assert.strictEqual(
            beforeConfirmation.rows.length,
            1,
            "Task must still exist before confirmation"
        );

        console.log(
            "PASS: natural-language delete_task resolved task and requires confirmation"
        );

        console.log(
            `Resolved task: ${testTitle} (ID ${testTaskId})`
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
            200,
            `Confirmation should return HTTP 200. Received ${response.status}: ${JSON.stringify(responseBody)}`
        );

        assert(
            responseBody.task,
            "Confirmation response should contain deleted task"
        );

        assert.strictEqual(
            Number(responseBody.task.id),
            Number(testTaskId),
            "Deleted task ID should match"
        );

        assert.strictEqual(
            responseBody.task.title,
            testTitle,
            "Deleted task title should match"
        );

        console.log(
            `PASS: confirmation executed delete_task successfully (task ID ${testTaskId})`
        );

        const afterConfirmation =
            await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE id = $1`,
                [testTaskId]
            );

        assert.strictEqual(
            afterConfirmation.rows.length,
            0,
            "Task should be deleted from database"
        );

        console.log(
            "PASS: task was deleted from database"
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

        testTaskId = null;

        await stopTestServer(server);
        server = null;

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language delete_task execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language delete_task execution test failed:"
        );

        console.error(error);

        if (testTaskId !== null) {
            try {
                await pool.query(
                    `DELETE FROM tasks
                     WHERE id = $1`,
                    [testTaskId]
                );

                console.log(
                    "PASS: failed-test task cleaned up"
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