const dotenv = require("dotenv");
dotenv.config();

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
        const request = http.request(
            {
                hostname: "localhost",
                port,
                path: "/api/ai/confirm",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        "Bearer " + token,
                    "Content-Length":
                        Buffer.byteLength(body)
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
                        status:
                            response.statusCode,
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

function createToken(userId, email) {
    return jwt.sign(
        {
            id: userId,
            email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
}

async function runTest() {
    let server = null;

    try {
        const userId = 16;

        const token = createToken(
            userId,
            "zyraaitest2026@gmail.com"
        );

        server = app.listen(5003, () => {
            console.log(
                "Resource authorization test API server started on port 5003"
            );
        });

        await new Promise((resolve) =>
            server.once("listening", resolve)
        );

        /*
         * VERIFY EXISTING TEST RESOURCES
         */

        const projectResult = await pool.query(
            `
            SELECT id, created_by
            FROM projects
            WHERE id = $1
            `,
            [2]
        );

        if (
            projectResult.rows.length === 0
        ) {
            throw new Error(
                "Expected test project 2 was not found"
            );
        }

        if (
            Number(
                projectResult.rows[0].created_by
            ) === userId
        ) {
            throw new Error(
                "Test project 2 is owned by the test user; choose another resource"
            );
        }

        const taskResult = await pool.query(
            `
            SELECT id, project_id, created_by
            FROM tasks
            WHERE id = $1
            `,
            [2]
        );

        if (
            taskResult.rows.length === 0
        ) {
            throw new Error(
                "Expected test task 2 was not found"
            );
        }

        if (
            Number(
                taskResult.rows[0].created_by
            ) === userId
        ) {
            throw new Error(
                "Test task 2 is owned by the test user; choose another resource"
            );
        }

        console.log(
            "PASS: Unauthorized test resources verified"
        );

        /*
         * UPDATE TASK
         */

        console.log("");
        console.log(
            "Testing confirmed update_task against an unauthorized task..."
        );

        const taskConfirmation =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "update_task",
                toolArguments: {
                    task_id: 2,
                    title:
                        "Unauthorized AI Task Update Test",
                    description:
                        "This update must be rejected",
                    assigned_to: null,
                    status: "pending",
                    priority: "medium",
                    deadline: null
                }
            });

        const taskResponse =
            await sendRequest({
                token,
                confirmationId:
                    taskConfirmation.confirmationId,
                port: 5003
            });

        console.log(
            "Task update HTTP status:",
            taskResponse.status
        );

        console.log(
            "Task update response:",
            taskResponse.body
        );

        if (
            taskResponse.status !==
            404
        ) {
            throw new Error(
                "Unauthorized task update was not rejected with 404"
            );
        }

        console.log(
            "PASS: Unauthorized task update was rejected"
        );

        /*
         * UPDATE PROJECT
         */

        console.log("");
        console.log(
            "Testing confirmed update_project against an unauthorized project..."
        );

        const projectConfirmation =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "update_project",
                toolArguments: {
                    project_id: 2,
                    name:
                        "Unauthorized AI Project Update Test",
                    description:
                        "This update must be rejected"
                }
            });

        const projectResponse =
            await sendRequest({
                token,
                confirmationId:
                    projectConfirmation.confirmationId,
                port: 5003
            });

        console.log(
            "Project update HTTP status:",
            projectResponse.status
        );

        console.log(
            "Project update response:",
            projectResponse.body
        );

        if (
            projectResponse.status !==
            403
        ) {
            throw new Error(
                "Unauthorized project update was not rejected with 403"
            );
        }

        console.log(
            "PASS: Unauthorized project update was rejected"
        );

        /*
         * VERIFY DATABASE RECORDS WERE NOT MODIFIED
         */

        const finalTaskResult =
            await pool.query(
                `
                SELECT id, title
                FROM tasks
                WHERE id = $1
                `,
                [2]
            );

        const finalProjectResult =
            await pool.query(
                `
                SELECT id, name
                FROM projects
                WHERE id = $1
                `,
                [2]
            );

        if (
            finalTaskResult.rows.length === 0
        ) {
            throw new Error(
                "Test task disappeared unexpectedly"
            );
        }

        if (
            finalProjectResult.rows.length === 0
        ) {
            throw new Error(
                "Test project disappeared unexpectedly"
            );
        }

        if (
            finalTaskResult.rows[0].title ===
            "Unauthorized AI Task Update Test"
        ) {
            throw new Error(
                "Unauthorized task was actually modified"
            );
        }

        if (
            finalProjectResult.rows[0].name ===
            "Unauthorized AI Project Update Test"
        ) {
            throw new Error(
                "Unauthorized project was actually modified"
            );
        }

        console.log(
            "PASS: Unauthorized resources were not modified"
        );

        console.log("");
        console.log(
            "Confirmation resource authorization evaluation passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Confirmation resource authorization evaluation failed."
        );
        console.error(error);
        process.exitCode = 1;
    } finally {
        if (server) {
            await new Promise(
                (resolve) =>
                    server.close(resolve)
            );

            console.log(
                "Resource authorization test API server stopped."
            );
        }

        await pool.end();
    }
}

runTest();