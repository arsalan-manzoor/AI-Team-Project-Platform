require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");

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

async function sendRequest({
    token,
    method,
    path,
    body = null
}) {
    const requestBody =
        body === null
            ? null
            : JSON.stringify(body);

    return new Promise((resolve, reject) => {
        const headers = {
            Authorization:
                `Bearer ${token}`
        };

        if (requestBody !== null) {
            headers["Content-Type"] =
                "application/json";

            headers["Content-Length"] =
                Buffer.byteLength(
                    requestBody
                );
        }

        const request =
            http.request(
                {
                    hostname: "localhost",
                    port: 5000,
                    path,
                    method,
                    headers
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

        if (requestBody !== null) {
            request.write(requestBody);
        }

        request.end();
    });
}

async function runTest() {
    let conversationId = null;

    try {
        const userId = 16;

        const token =
            createToken(
                userId,
                "zyraaitest2026@gmail.com"
            );

        console.log(
            "Creating conversation through API..."
        );

        const response =
            await sendRequest({
                token,
                method: "POST",
                path:
                    "/api/ai/conversations",
                body: {
                    title:
                        "API Conversation Test"
                }
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
                "Conversation creation API returned an unexpected status"
            );
        }

        if (
            !response.body ||
            !Number.isInteger(
                response.body.id
            )
        ) {
            throw new Error(
                "Conversation creation API did not return a valid conversation ID"
            );
        }

        conversationId =
            response.body.id;

        if (
            response.body.user_id !==
            userId
        ) {
            throw new Error(
                "Conversation was not created for the authenticated user"
            );
        }

        if (
            response.body.title !==
            "API Conversation Test"
        ) {
            throw new Error(
                "Conversation title was not stored correctly"
            );
        }

        console.log(
            "PASS: Conversation created through API"
        );

        console.log("");
        console.log(
            "Verifying conversation in PostgreSQL..."
        );

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    user_id,
                    title
                FROM ai_conversations
                WHERE id = $1
                `,
                [conversationId]
            );

        if (
            result.rows.length !== 1
        ) {
            throw new Error(
                "Created conversation was not found in PostgreSQL"
            );
        }

        const databaseConversation =
            result.rows[0];

        if (
            databaseConversation.user_id !==
            userId
        ) {
            throw new Error(
                "Database conversation ownership is incorrect"
            );
        }

        console.log(
            "PASS: Conversation stored correctly in PostgreSQL"
        );

        console.log("");
        console.log(
            "Conversation creation API test passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Conversation creation API test failed:"
        );
        console.error(error.message);

        process.exitCode = 1;
    } finally {
        if (conversationId) {
            await pool.query(
                `
                DELETE FROM ai_conversations
                WHERE id = $1
                `,
                [conversationId]
            );

            console.log(
                "Test conversation cleaned up."
            );
        }

        await pool.end();
    }
}

runTest();