require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");

const {
    createConversation
} = require("../src/services/aiConversation.service");

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
    conversationId
}) {
    const body = JSON.stringify({
        conversationId,
        messages: [
            {
                role: "user",
                content:
                    "What is the name of my authorized project?"
            }
        ]
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
        const ownerUserId = 16;

        const ownerToken =
            createToken(
                ownerUserId,
                "zyraaitest2026@gmail.com"
            );

        const unauthorizedUserId = 999999;

        const unauthorizedToken =
            createToken(
                unauthorizedUserId,
                "unauthorized@zyra.test"
            );

        console.log(
            "Creating conversation for owner..."
        );

        const conversation =
            await createConversation(
                ownerUserId,
                "Conversation Ownership Test"
            );

        conversationId =
            conversation.id;

        console.log(
            `PASS: Conversation created with ID ${conversationId}`
        );

        console.log("");
        console.log(
            "Testing owner access..."
        );

        const ownerResponse =
            await sendRequest({
                token: ownerToken,
                conversationId
            });

        console.log(
            "Owner HTTP status:",
            ownerResponse.status
        );

        if (
            ownerResponse.status !== 200
        ) {
            throw new Error(
                "Conversation owner could not access their conversation"
            );
        }

        console.log(
            "PASS: Conversation owner can access conversation"
        );

        console.log("");
        console.log(
            "Testing unauthorized access..."
        );

        const unauthorizedResponse =
            await sendRequest({
                token:
                    unauthorizedToken,
                conversationId
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
                "Unauthorized user was able to access another user's conversation"
            );
        }

        console.log(
            "PASS: Unauthorized user cannot access conversation"
        );

        console.log("");
        console.log(
            "Conversation ownership API test passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Conversation ownership API test failed:"
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