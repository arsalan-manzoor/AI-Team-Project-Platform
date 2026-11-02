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
    let taskId = null;
    let server = null;

    try {
        const ownerUserId = 16;
        const otherUserId = 6;

        const ownerToken = createToken(
            ownerUserId,
            "zyraaitest2026@gmail.com"
        );

        const otherUserToken = createToken(
            otherUserId,
            "zyra-other-user-test@gmail.com"
        );

        server = app.listen(5002, () => {
            console.log(
                "Authorization test API server started on port 5002"
            );
        });

        await new Promise((resolve) =>
            server.once("listening", resolve)
        );

        const testTitle =
            "AI Authorization Test " +
            Date.now();

        /*
         * CREATE CONFIRMATION FOR USER 16
         */

        const confirmation =
            createConfirmation({
                userId: ownerUserId,
                conversationId: null,
                toolName: "create_task",
                toolArguments: {
                    title: testTitle,
                    description:
                        "Created by AI confirmation authorization evaluation",
                    project_id: 6
                }
            });

        console.log(
            "PASS: Confirmation created for owner user"
        );

        /*
         * TRY USING THE CONFIRMATION WITH ANOTHER USER
         */

        console.log(
            "Testing confirmation access by another user..."
        );

        const unauthorizedResponse =
            await sendRequest({
                token: otherUserToken,
                confirmationId:
                    confirmation.confirmationId,
                port: 5002
            });

        console.log(
            "Unauthorized HTTP status:",
            unauthorizedResponse.status
        );

        console.log(
            "Unauthorized response:",
            unauthorizedResponse.body
        );

        if (
            unauthorizedResponse.status !==
            404
        ) {
            throw new Error(
                "Unauthorized user was able to access the confirmation"
            );
        }

        console.log(
            "PASS: Another user cannot use the confirmation"
        );

        /*
         * VERIFY THE ORIGINAL USER CAN STILL USE IT
         */

        console.log(
            "Testing confirmation with the original user..."
        );

        const authorizedResponse =
            await sendRequest({
                token: ownerToken,
                confirmationId:
                    confirmation.confirmationId,
                port: 5002
            });

        console.log(
            "Authorized HTTP status:",
            authorizedResponse.status
        );

        console.log(
            "Authorized response:",
            authorizedResponse.body
        );

        if (
            authorizedResponse.status !==
            201
        ) {
            throw new Error(
                "Original user could not execute the confirmation"
            );
        }

        if (
            !authorizedResponse.body ||
            !authorizedResponse.body.task
        ) {
            throw new Error(
                "Authorized confirmation did not return the created task"
            );
        }

        taskId =
            authorizedResponse.body.task.id;

        if (
            authorizedResponse.body.task.title !==
            testTitle
        ) {
            throw new Error(
                "Created task title does not match the confirmation"
            );
        }

        console.log(
            "PASS: Original user can execute the confirmation"
        );

        /*
         * VERIFY SINGLE-USE BEHAVIOR
         */

        console.log(
            "Testing confirmation reuse..."
        );

        const reuseResponse =
            await sendRequest({
                token: ownerToken,
                confirmationId:
                    confirmation.confirmationId,
                port: 5002
            });

        console.log(
            "Reuse HTTP status:",
            reuseResponse.status
        );

        console.log(
            "Reuse response:",
            reuseResponse.body
        );

        if (
            reuseResponse.status !==
            404
        ) {
            throw new Error(
                "Confirmation could be reused after execution"
            );
        }

        console.log(
            "PASS: Confirmation cannot be reused"
        );

        console.log("");
        console.log(
            "Confirmation authorization evaluation passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Confirmation authorization evaluation failed."
        );
        console.error(error);
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
                "Authorization test task cleaned up."
            );
        }

        if (server) {
            await new Promise(
                (resolve) =>
                    server.close(resolve)
            );

            console.log(
                "Authorization test API server stopped."
            );
        }

        await pool.end();
    }
}

runTest();