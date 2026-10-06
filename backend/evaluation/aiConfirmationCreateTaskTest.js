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
    const projectId = 2;

    const testTaskTitle =
        "Confirmation Create Task Test";

    const existingResult =
        await pool.query(
            `SELECT id
             FROM tasks
             WHERE title = $1`,
            [testTaskTitle]
        );

    for (
        const task of existingResult.rows
    ) {
        await pool.query(
            `DELETE FROM tasks
             WHERE id = $1`,
            [task.id]
        );
    }

    const confirmation =
        createConfirmation({
            userId,
            toolName: "create_task",
            toolArguments: {
                project_id: projectId,
                title: testTaskTitle
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
        const beforeResult =
            await pool.query(
                `SELECT id
                 FROM tasks
                 WHERE title = $1`,
                [testTaskTitle]
            );

        if (
            beforeResult.rows.length !== 0
        ) {
            throw new Error(
                "Test task already exists before confirmation"
            );
        }

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
            response.status !== 201
        ) {
            throw new Error(
                `Expected HTTP 201, received ${response.status}: ${JSON.stringify(response.body)}`
            );
        }

        if (
            !response.body ||
            !response.body.task
        ) {
            throw new Error(
                "Expected created task in confirmation response"
            );
        }

        if (
            response.body.task.title !==
            testTaskTitle
        ) {
            throw new Error(
                "Confirmed task creation did not return the expected title"
            );
        }

        const afterResult =
            await pool.query(
                `SELECT id, title
                 FROM tasks
                 WHERE title = $1`,
                [testTaskTitle]
            );

        if (
            afterResult.rows.length !== 1
        ) {
            throw new Error(
                "Expected exactly one created test task"
            );
        }

        console.log(
            "PASS: confirmation executed create_task successfully"
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
            `DELETE FROM tasks
             WHERE title = $1`,
            [testTaskTitle]
        );

        console.log(
            "PASS: temporary test task removed"
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