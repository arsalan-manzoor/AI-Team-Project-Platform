require("dotenv").config();

const jwt = require("jsonwebtoken");
const http = require("http");

const pool = require("../src/config/db");
const app = require("../src/app");

const {
    createConfirmation,
    getConfirmation,
    deleteConfirmation
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
    const taskId = 2;

    const taskResult =
        await pool.query(
            `SELECT
                id,
                title,
                created_by
             FROM tasks
             WHERE id = $1`,
            [taskId]
        );

    if (
        taskResult.rows.length === 0
    ) {
        throw new Error(
            "Test task was not found"
        );
    }

    if (
        taskResult.rows[0].created_by ===
        userId
    ) {
        throw new Error(
            "Selected task is created by test user; choose an unauthorized task"
        );
    }

    const originalTitle =
        taskResult.rows[0].title;

    const attemptedTitle =
        "Unauthorized Confirmation Test";

    const confirmation =
        createConfirmation({
            userId,
            toolName: "update_task",
            toolArguments: {
                task_id: taskId,
                title: attemptedTitle
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
            response.status !== 403
        ) {
            throw new Error(
                `Expected HTTP 403, received ${response.status}: ${JSON.stringify(response.body)}`
            );
        }

        console.log(
            "PASS: unauthorized confirmed update was rejected"
        );

        const afterResult =
            await pool.query(
                `SELECT title
                 FROM tasks
                 WHERE id = $1`,
                [taskId]
            );

        if (
            afterResult.rows.length !== 1
        ) {
            throw new Error(
                "Test task disappeared after failed confirmation"
            );
        }

        if (
            afterResult.rows[0].title !==
            originalTitle
        ) {
            throw new Error(
                "Task was modified despite failed confirmation"
            );
        }

        console.log(
            "PASS: database was unchanged after failed confirmation"
        );

        const remainingConfirmation =
            getConfirmation(
                confirmation.confirmationId,
                userId
            );

        if (
            !remainingConfirmation
        ) {
            throw new Error(
                "Confirmation was incorrectly consumed after failed execution"
            );
        }

        console.log(
            "PASS: confirmation remained available after failed execution"
        );

    } finally {
        deleteConfirmation(
            confirmation.confirmationId,
            userId
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