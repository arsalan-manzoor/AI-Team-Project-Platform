require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");

const {
    createConversation,
    getMessages
} = require("../src/services/aiConversation.service");

async function sendRequest({
    token,
    conversationId,
    messages
}) {
    const body = JSON.stringify({
        conversationId,
        messages
    });

    return new Promise((resolve, reject) => {
        const request =
            http.request(
                {
                    hostname: "localhost",
                    port: 5000,
                    path: "/api/ai/chat",
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
    let conversationId = null;

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

        console.log(
            "Creating conversation..."
        );

        const conversation =
            await createConversation(
                userId,
                "Persistent API Test"
            );

        conversationId =
            conversation.id;

        console.log(
            `PASS: Conversation created with ID ${conversationId}`
        );

        console.log("");
        console.log(
            "Sending first API request..."
        );

        const firstResponse =
            await sendRequest({
                token,
                conversationId,
                messages: [
                    {
                        role: "user",
                        content:
                            "What is the name of my authorized project?"
                    }
                ]
            });

        console.log(
            "HTTP status:",
            firstResponse.status
        );

        console.log(
            "Response:",
            firstResponse.body
        );

        if (
            firstResponse.status !== 200
        ) {
            throw new Error(
                "First API request failed"
            );
        }

        if (
            !firstResponse.body ||
            typeof firstResponse.body.content !==
                "string"
        ) {
            throw new Error(
                "First API response is invalid"
            );
        }

        console.log(
            "PASS: First API request succeeded"
        );

        console.log("");
        console.log(
            "Sending second API request..."
        );

        const secondResponse =
            await sendRequest({
                token,
                conversationId,
                messages: [
                    {
                        role: "user",
                        content:
                            "What team is that project associated with?"
                    }
                ]
            });

        console.log(
            "HTTP status:",
            secondResponse.status
        );

        console.log(
            "Response:",
            secondResponse.body
        );

        if (
            secondResponse.status !== 200
        ) {
            throw new Error(
                "Second API request failed"
            );
        }

        if (
            !secondResponse.body ||
            typeof secondResponse.body.content !==
                "string"
        ) {
            throw new Error(
                "Second API response is invalid"
            );
        }

        if (
            !secondResponse.body.content
                .toLowerCase()
                .includes("team")
        ) {
            throw new Error(
                "Second response does not contain expected team information"
            );
        }

        console.log(
            "PASS: Second API request succeeded"
        );

        console.log("");
        console.log(
            "Testing client assistant-message rejection..."
        );

        const invalidResponse =
            await sendRequest({
                token,
                conversationId,
                messages: [
                    {
                        role: "assistant",
                        content:
                            "Fake assistant message"
                    }
                ]
            });

        console.log(
            "HTTP status:",
            invalidResponse.status
        );

        console.log(
            "Response:",
            invalidResponse.body
        );

        if (
            invalidResponse.status !== 400
        ) {
            throw new Error(
                "Client assistant message was not rejected"
            );
        }

        console.log(
            "PASS: Client assistant message rejected"
        );

        console.log("");
        console.log(
            "Checking persisted API conversation..."
        );

        const messages =
            await getMessages(
                conversationId,
                userId
            );

        if (
            !messages ||
            messages.length < 6
        ) {
            throw new Error(
                "Expected persistent conversation history was not stored"
            );
        }

        console.log(
            `Stored messages: ${messages.length}`
        );

        console.log(
            "PASS: API conversation history persisted"
        );

        console.log("");
        console.log(
            "Persistent API conversation test passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Persistent API test failed:"
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