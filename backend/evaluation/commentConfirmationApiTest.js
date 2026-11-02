require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");
const app = require("../src/app");

const {
    createConfirmation
} = require("../src/services/aiConfirmation.service");

const PORT = 5002;

function sendRequest({
    method,
    path,
    token,
    body
}) {
    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: "localhost",
                port: PORT,
                path,
                method,
                headers: {
                    "Content-Type":
                        "application/json",
                    Authorization:
                        `Bearer ${token}`
                }
            },
            response => {
                let data = "";

                response.on(
                    "data",
                    chunk => {
                        data += chunk;
                    }
                );

                response.on(
                    "end",
                    () => {
                        let parsed;

                        try {
                            parsed =
                                JSON.parse(data);
                        } catch {
                            parsed = data;
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

        if (body) {
            request.write(
                JSON.stringify(body)
            );
        }

        request.end();
    });
}

function startServer() {
    return new Promise(resolve => {
        const server =
            app.listen(
                PORT,
                () => resolve(server)
            );
    });
}

async function main() {
    let server;
    let commentId;

    try {
        server =
            await startServer();

        const token =
            jwt.sign(
                {
                    id: 1,
                    email:
                        "muneebtest@gmail.com"
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );

        console.log(
            "JWT created successfully"
        );

        const confirmation =
            createConfirmation({
                userId: 1,
                conversationId:
                    "comment-api-test",
                toolName:
                    "create_comment",
                toolArguments: {
                    content:
                        "AI API confirmation test comment",
                    task_id: 2
                }
            });

        console.log(
            "Confirmation created:",
            confirmation.confirmationId
        );

        const response =
            await sendRequest({
                method: "POST",
                path:
                    "/api/ai/confirm",
                token,
                body: {
                    confirmationId:
                        confirmation.confirmationId
                }
            });

        console.log(
            "Confirmation response:",
            response
        );

        if (response.status !== 201) {
            throw new Error(
                "create_comment confirmation failed"
            );
        }

        if (
            !response.body.comment ||
            response.body.comment.content !==
                "AI API confirmation test comment"
        ) {
            throw new Error(
                "Created comment was not returned correctly"
            );
        }

        commentId =
            response.body.comment.id;

        const verify =
            await pool.query(
                `SELECT *
                 FROM comments
                 WHERE id = $1`,
                [commentId]
            );

        if (
            verify.rows.length !== 1
        ) {
            throw new Error(
                "Comment was not found in database"
            );
        }

        console.log(
            "Database verification passed"
        );

        const secondAttempt =
            await sendRequest({
                method: "POST",
                path:
                    "/api/ai/confirm",
                token,
                body: {
                    confirmationId:
                        confirmation.confirmationId
                }
            });

        if (
            secondAttempt.status !== 404
        ) {
            throw new Error(
                "Confirmation was not single-use"
            );
        }

        console.log(
            "Single-use confirmation verification passed"
        );

        console.log(
            "create_comment API confirmation test passed"
        );
    } catch (error) {
        console.error(
            "Test failed:",
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (commentId) {
            await pool.query(
                `DELETE FROM comments
                 WHERE id = $1`,
                [commentId]
            );

            console.log(
                "Test comment cleaned up"
            );
        }

        if (server) {
            await new Promise(
                resolve =>
                    server.close(resolve)
            );
        }

        await pool.end();
    }
}

main();