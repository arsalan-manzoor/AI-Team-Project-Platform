require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const pool = require("../src/config/db");

const {
    createConfirmation,
    getConfirmation,
    deleteConfirmation
} = require("../src/services/aiConfirmation.service");

const TEST_USER_ID = 1;
const TEST_TASK_ID = 3;

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer(app);

        server.listen(0, () => {
            const address = server.address();

            resolve({
                server,
                port: address.port
            });
        });
    });
}

function postConfirmation(port, token, confirmationId) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            confirmationId
        });

        const request = http.request(
            {
                hostname: "127.0.0.1",
                port,
                path: "/api/ai/confirm",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length":
                        Buffer.byteLength(body),
                    Authorization:
                        `Bearer ${token}`
                }
            },
            (response) => {
                let data = "";

                response.on("data", (chunk) => {
                    data += chunk;
                });

                response.on("end", () => {
                    let parsed;

                    try {
                        parsed = JSON.parse(data);
                    } catch {
                        parsed = {
                            raw: data
                        };
                    }

                    resolve({
                        status: response.statusCode,
                        body: parsed
                    });
                });
            }
        );

        request.on("error", reject);

        request.write(body);
        request.end();
    });
}

async function main() {
    let server;
    let confirmationId;

    const originalResult = await pool.query(
        `SELECT
            id,
            title,
            description,
            assigned_to,
            status,
            priority,
            deadline
         FROM tasks
         WHERE id = $1`,
        [TEST_TASK_ID]
    );

    if (originalResult.rows.length === 0) {
        throw new Error(
            `Test task ${TEST_TASK_ID} was not found`
        );
    }

    const originalTask =
        originalResult.rows[0];

    const token = jwt.sign(
        {
            id: TEST_USER_ID,
            email: "test@example.com"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );

    const confirmation =
        createConfirmation({
            userId: TEST_USER_ID,
            conversationId:
                "concurrency-test",
            toolName: "update_task",
            toolArguments: {
                task_id: TEST_TASK_ID,
                title:
                    originalTask.title +
                    " - concurrency test",
                description:
                    originalTask.description,
                assigned_to:
                    originalTask.assigned_to,
                status:
                    originalTask.status,
                priority:
                    originalTask.priority,
                deadline:
                    originalTask.deadline
            }
        });

    confirmationId =
        confirmation.confirmationId;

    const started =
        await startServer();

    server = started.server;

    try {
        const results = await Promise.all([
            postConfirmation(
                started.port,
                token,
                confirmationId
            ),
            postConfirmation(
                started.port,
                token,
                confirmationId
            )
        ]);

        const successCount =
            results.filter(
                (result) =>
                    result.status === 200
            ).length;

        const rejectedCount =
            results.filter(
                (result) =>
                    result.status === 404
            ).length;

        if (successCount !== 1) {
            throw new Error(
                `Expected exactly one successful confirmation, got ${successCount}`
            );
        }

        console.log(
            "PASS: exactly one concurrent confirmation executed"
        );

        if (rejectedCount !== 1) {
            throw new Error(
                `Expected exactly one rejected concurrent confirmation, got ${rejectedCount}`
            );
        }

        console.log(
            "PASS: second concurrent confirmation was rejected"
        );

        const updatedResult =
            await pool.query(
                `SELECT
                    id,
                    title
                 FROM tasks
                 WHERE id = $1`,
                [TEST_TASK_ID]
            );

        const updatedTask =
            updatedResult.rows[0];

        const expectedTitle =
            originalTask.title +
            " - concurrency test";

        if (
            updatedTask.title !==
            expectedTitle
        ) {
            throw new Error(
                "Task was not updated exactly as expected"
            );
        }

        console.log(
            "PASS: task was updated exactly once"
        );

        if (
            getConfirmation(
                confirmationId,
                TEST_USER_ID
            ) !== null
        ) {
            throw new Error(
                "Confirmation was still available after successful execution"
            );
        }

        console.log(
            "PASS: confirmation was consumed after successful execution"
        );

        await pool.query(
            `UPDATE tasks
             SET title = $1
             WHERE id = $2`,
            [
                originalTask.title,
                TEST_TASK_ID
            ]
        );

        const restoredResult =
            await pool.query(
                `SELECT title
                 FROM tasks
                 WHERE id = $1`,
                [TEST_TASK_ID]
            );

        if (
            restoredResult.rows[0].title !==
            originalTask.title
        ) {
            throw new Error(
                "Original task title was not restored"
            );
        }

        console.log(
            "PASS: original task value restored"
        );
    } finally {
        if (confirmationId) {
            deleteConfirmation(
                confirmationId,
                TEST_USER_ID
            );
        }

        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
            });
        }

        await pool.end();
    }
}

main().catch((error) => {
    console.error(
        "FAIL:",
        error.message
    );

    process.exit(1);
});