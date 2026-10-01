require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const pool = require("../src/config/db");

const {
    createConfirmation
} = require("../src/services/aiConfirmation.service");

async function sendRequest({
    token,
    confirmationId,
    port
}) {
    const body = JSON.stringify({
        confirmationId
    });

    return new Promise((resolve, reject) => {
        const request =
            http.request(
                {
                    hostname: "localhost",
                    port,
                    path: "/api/ai/confirm",
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Authorization":
                            `Bearer ${token}`,
                        "Content-Length":
                            Buffer.byteLength(body)
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
                                parsed = {
                                    raw: data
                                };
                            }

                            resolve({
                                status:
                                    response.statusCode,
                                body: parsed
                            });
                        }
                    );
                }
            );

        request.on(
            "error",
            reject
        );

        request.write(body);
        request.end();
    });
}

async function runTest() {
    let taskId = null;
    let server = null;

    try {
        const userId = 16;

        const token =
            jwt.sign(
                {
                    id: userId,
                    email:
                        "zyraaitest2026@gmail.com"
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

        server =
            app.listen(
                5001,
                () => {
                    console.log(
                        "Test API server started on port 5001"
                    );
                }
            );

        await new Promise(
            (resolve) =>
                server.once(
                    "listening",
                    resolve
                )
        );

        const testTitle =
            `AI Confirmation API Test ${Date.now()}`;

        console.log(
            "Creating test confirmation..."
        );

        const confirmation =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "create_task",
                toolArguments: {
                    title: testTitle,
                    description:
                        "Created by confirmation API evaluation",
                    project_id: 6
                }
            });

        console.log(
            "PASS: Test confirmation created"
        );

        console.log("");
        console.log(
            "Sending confirmation request..."
        );

        const response =
            await sendRequest({
                token,
                confirmationId:
                    confirmation.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            response.status
        );

        console.log(
            "Response:",
            response.body
        );

        if (
            response.status !== 201
        ) {
            throw new Error(
                "Confirmation API request failed"
            );
        }

        if (
            !response.body ||
            !response.body.task
        ) {
            throw new Error(
                "Confirmation API did not return the created task"
            );
        }

        taskId =
            response.body.task.id;

        if (
            response.body.task.title !==
            testTitle
        ) {
            throw new Error(
                "Created task has the wrong title"
            );
        }

        console.log(
            "PASS: Confirmed AI action created the task"
        );

        console.log("");
        console.log(
            "Testing confirmation single-use behavior..."
        );

        const secondResponse =
            await sendRequest({
                token,
                confirmationId:
                    confirmation.confirmationId,
                port: 5001
            });

        console.log(
            "Second HTTP status:",
            secondResponse.status
        );

        console.log(
            "Second response:",
            secondResponse.body
        );

        if (
            secondResponse.status !== 404
        ) {
            throw new Error(
                "Confirmation was reusable"
            );
        }

        console.log(
            "PASS: Confirmation cannot be reused"
        );

        console.log("");
        console.log(
            "Confirmation API evaluation passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Confirmation API test failed:"
        );
        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (taskId) {
            await pool.query(
                `
                DELETE FROM tasks
                WHERE id = $1
                `,
                [taskId]
            );

            console.log(
                "Test task cleaned up."
            );
        }

        if (server) {
            await new Promise(
                (resolve) =>
                    server.close(
                        resolve
                    )
            );

            console.log(
                "Test API server stopped."
            );
        }

        await pool.end();
    }
}

runTest();