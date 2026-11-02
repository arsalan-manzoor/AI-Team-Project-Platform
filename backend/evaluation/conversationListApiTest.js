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

async function createTestConversation(
    userId,
    title
) {
    const result = await pool.query(
        `
        INSERT INTO ai_conversations (
            user_id,
            title
        )
        VALUES ($1, $2)
        RETURNING id
        `,
        [userId, title]
    );

    return result.rows[0].id;
}

async function deleteTestConversations(ids) {
    if (ids.length === 0) {
        return;
    }

    await pool.query(
        `
        DELETE FROM ai_conversations
        WHERE id = ANY($1::integer[])
        `,
        [ids]
    );
}

async function runTest() {
    const token = createToken(USER_ID);

    const conversationIds = [];

    try {
        console.log(
            "Creating test conversations..."
        );

        const firstId =
            await createTestConversation(
                USER_ID,
                "List Test One"
            );

        const secondId =
            await createTestConversation(
                USER_ID,
                "List Test Two"
            );

        conversationIds.push(
            firstId,
            secondId
        );

        console.log(
            "Fetching conversations through API..."
        );

        const response = await fetch(
            `${BASE_URL}/api/ai/conversations`,
            {
                method: "GET",
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

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
                "Conversation list API returned an unexpected status"
            );
        }

        if (!Array.isArray(data)) {
            throw new Error(
                "Conversation list API did not return an array"
            );
        }

        const firstConversation =
            data.find(
                (conversation) =>
                    conversation.id === firstId
            );

        const secondConversation =
            data.find(
                (conversation) =>
                    conversation.id === secondId
            );

        if (!firstConversation) {
            throw new Error(
                "First test conversation was not returned"
            );
        }

        if (!secondConversation) {
            throw new Error(
                "Second test conversation was not returned"
            );
        }

        if (
            firstConversation.user_id !==
            USER_ID ||
            secondConversation.user_id !==
            USER_ID
        ) {
            throw new Error(
                "Conversation ownership data is incorrect"
            );
        }

        console.log(
            "PASS: Conversations returned through API"
        );

        console.log(
            "Verifying another user cannot see them..."
        );

        const otherUserToken =
            createToken(999999);

        const otherResponse =
            await fetch(
                `${BASE_URL}/api/ai/conversations`,
                {
                    method: "GET",
                    headers: {
                        Authorization:
                            `Bearer ${otherUserToken}`
                    }
                }
            );

        const otherData =
            await otherResponse.json();

        if (otherResponse.status !== 200) {
            throw new Error(
                "Other user conversation list request failed"
            );
        }

        if (!Array.isArray(otherData)) {
            throw new Error(
                "Other user response was not an array"
            );
        }

        const unauthorizedConversation =
            otherData.find(
                (conversation) =>
                    conversation.id === firstId ||
                    conversation.id === secondId
            );

        if (unauthorizedConversation) {
            throw new Error(
                "Other user could access test conversations"
            );
        }

        console.log(
            "PASS: Conversation ownership is enforced"
        );

        console.log(
            "\nConversation list API test passed."
        );
    } catch (error) {
        console.error(
            "\nConversation list API test failed:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        await deleteTestConversations(
            conversationIds
        );

        console.log(
            "Test conversations cleaned up."
        );

        await pool.end();
    }
}

runTest();