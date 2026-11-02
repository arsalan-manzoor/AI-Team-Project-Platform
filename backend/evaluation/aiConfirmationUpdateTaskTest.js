require("dotenv").config();

const jwt = require("jsonwebtoken");
const http = require("http");

const pool = require("../src/config/db");
const app = require("../src/app");

const {
    createConfirmation
} = require("../src/services/aiConfirmation.service");

async function startServer() {
    return new Promise((resolve) => {
        const server = app.listen(0, () => {
            const address = server.address();

            resolve({
                server,
                port: address.port
            });
        });
    });
}

function makeRequest({
    port,
    token,
    body
}) {
    return new Promise((resolve, reject) => {
        const requestBody =
            JSON.stringify(body);

        const request =
            http.request(
                {
                    hostname: "127.0.0.1",
                    port,
                    path: "/api/ai/confirm",
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Content-Length":
                            Buffer.byteLength(
                                requestBody
                            ),
                        Authorization:
                            `Bearer ${token}`
                    }
                },
                (response) => {
                    let data = "";

                    response.on(
                        "data",
                        (chunk) => {
                            data += chunk;
                        }
                    );

                    response.on(
                        "end",
                        () => {
                            let parsed;

                            try {
                                parsed =
                                    JSON.parse(
                                        data
                                    );
                            } catch {
                                parsed = data;
                            }

                            resolve({
                                status:
                                    response.statusCode,
                                body:
                                    parsed
                            });
                        }
                    );
                }
            );

        request.on(
            "error",
            reject
        );

        request.write(
            requestBody
        );

        request.end();
    });
}

async function main() {
    const userId = 1;
    const taskId = 3;

    const originalResult =
        await pool.query(
            `SELECT
                tasks.id,
                tasks.title,
                tasks.description,
                tasks.assigned_to,
                tasks.status,
                tasks.priority,
                tasks.deadline
             FROM tasks
             WHERE tasks.id = $1
               AND tasks.created_by = $2`,
            [taskId, userId]
        );

    if (
        originalResult.rows.length === 0
    ) {
        throw new Error(
            "Task created by test user was not found"
        );
    }

    const originalTask =
        originalResult.rows[0];

    const updatedTitle =
        "Confirmation Execution Test";

    const confirmation =
        createConfirmation({
            userId,
            toolName: "update_task",
            toolArguments: {
                task_id: taskId,
                title: updatedTitle
            }
        });

    if (
        !confirmation ||
        !confirmation.confirmationId
    ) {
        throw new Error(
            "Failed to create confirmation"
        );
    }

    const token = jwt.sign(
        {
            id: userId,
            email: "test@example.com"
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

    const {
        server,
        port
    } = await startServer();

    try {
        const response =
            await makeRequest({
                port,
                token,
                body: {
                    confirmationId:
                        confirmation.confirmationId
                }
            });

        if (
            response.status !== 200
        ) {
            throw new Error(
                `Expected HTTP 200, received ${response.status}: ${JSON.stringify(response.body)}`
            );
        }

        if (
            !response.body ||
            !response.body.task
        ) {
            throw new Error(
                "Expected updated task in confirmation response"
            );
        }

        if (
            response.body.task.title !==
            updatedTitle
        ) {
            throw new Error(
                "Confirmed task update did not return the updated title"
            );
        }

        const updatedResult =
            await pool.query(
                `SELECT title
                 FROM tasks
                 WHERE id = $1`,
                [taskId]
            );

        if (
            updatedResult.rows.length === 0
        ) {
            throw new Error(
                "Task disappeared after confirmation"
            );
        }

        if (
            updatedResult.rows[0].title !==
            updatedTitle
        ) {
            throw new Error(
                "Database task was not updated after confirmation"
            );
        }

        console.log(
            "PASS: confirmation executed update_task successfully"
        );

        const reuseResponse =
            await makeRequest({
                port,
                token,
                body: {
                    confirmationId:
                        confirmation.confirmationId
                }
            });

        if (
            reuseResponse.status !== 404
        ) {
            throw new Error(
                `Expected reused confirmation to return HTTP 404, received ${reuseResponse.status}`
            );
        }

        console.log(
            "PASS: confirmation could not be reused"
        );

    } finally {
        await pool.query(
            `UPDATE tasks
             SET title = $1,
                 description = $2,
                 assigned_to = $3,
                 status = $4,
                 priority = $5,
                 deadline = $6
             WHERE id = $7`,
            [
                originalTask.title,
                originalTask.description,
                originalTask.assigned_to,
                originalTask.status,
                originalTask.priority,
                originalTask.deadline,
                taskId
            ]
        );

        console.log(
            "PASS: original task values restored"
        );

        server.close();

        await pool.end();
    }
}

main().catch((error) => {
    console.error(
        `FAIL: ${error.message}`
    );

    process.exit(1);
});