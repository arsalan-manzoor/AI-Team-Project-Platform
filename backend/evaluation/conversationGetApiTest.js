require("dotenv").config();

const jwt = require("jsonwebtoken");
const pool = require("../src/config/db");

const BASE_URL = "http://localhost:5000";

const USER_ID = 16;
const JWT_SECRET = process.env.JWT_SECRET;

function createToken(userId) {
    return jwt.sign(
        {
            id: userId,
            email: "zyraaitest2026@gmail.com"
        },
        JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );
}

async function createTestConversation() {
    const result = await pool.query(
        `
        INSERT INTO ai_conversations (
            user_id,
            title
        )
        VALUES ($1, $2)
        RETURNING id
        `,
        [
            USER_ID,
            "Get Conversation API Test"
        ]
    );

    return result.rows[0].id;
}

async function createTestMessages(
    conversationId
) {
    await pool.query(
        `
        INSERT INTO ai_messages (
            conversation_id,
            role,
            content
        )
        VALUES
            ($1, 'user', 'Hello from test'),
            ($1, 'assistant', 'Hello from assistant')
        `,
        [conversationId]
    );
}

async function deleteTestConversation(
    conversationId
) {
    await pool.query(
        `
        DELETE FROM ai_conversations
        WHERE id = $1
        `,
        [conversationId]
    );
}

async function runTest() {
    let conversationId = null;

    try {
        conversationId =
            await createTestConversation();

        await createTestMessages(
            conversationId
        );

        const ownerToken =
            createToken(USER_ID);

        console.log(
            "Fetching conversation through API..."
        );

        const response = await fetch(
            `${BASE_URL}/api/ai/conversations/${conversationId}`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${ownerToken}`
                }
            }
        );

        const data =
            await response.json();

        console.log(
            "HTTP status:",
            response.status
        );

        console.log(
            "Response:",
            data
        );

        if (response.status !== 200) {
            throw new Error(
                "Conversation retrieval API returned an unexpected status"
            );
        }

        if (
            !data.conversation ||
            data.conversation.id !==
                conversationId
        ) {
            throw new Error(
                "Conversation data was not returned correctly"
            );
        }

        if (
            data.conversation.user_id !==
            USER_ID
        ) {
            throw new Error(
                "Conversation ownership data is incorrect"
            );
        }

        if (
            !Array.isArray(data.messages)
        ) {
            throw new Error(
                "Conversation messages were not returned as an array"
            );
        }

        if (
            data.messages.length !== 2
        ) {
            throw new Error(
                "Expected two conversation messages"
            );
        }

        console.log(
            "PASS: Owner can retrieve conversation and messages"
        );

        console.log(
            "Testing unauthorized conversation access..."
        );

        const otherUserToken =
            createToken(999999);

        const unauthorizedResponse =
            await fetch(
                `${BASE_URL}/api/ai/conversations/${conversationId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${otherUserToken}`
                    }
                }
            );

        const unauthorizedData =
            await unauthorizedResponse.json();

        console.log(
            "Unauthorized HTTP status:",
            unauthorizedResponse.status
        );

        console.log(
            "Unauthorized response:",
            unauthorizedData
        );

        if (
            unauthorizedResponse.status !==
            404
        ) {
            throw new Error(
                "Unauthorized conversation access was not blocked"
            );
        }

        console.log(
            "PASS: Unauthorized conversation access blocked"
        );

        console.log(
            "\nConversation retrieval API test passed."
        );
    } catch (error) {
        console.error(
            "\nConversation retrieval API test failed:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (conversationId !== null) {
            await deleteTestConversation(
                conversationId
            );
        }

        console.log(
            "Test conversation cleaned up."
        );

        await pool.end();
    }
}

runTest();