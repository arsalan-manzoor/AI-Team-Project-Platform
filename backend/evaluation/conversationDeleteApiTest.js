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

async function createTestMessage(
    conversationId
) {
    await pool.query(
        `
        INSERT INTO ai_messages (
            conversation_id,
            role,
            content
        )
        VALUES (
            $1,
            'user',
            'Message that should be deleted'
        )
        `,
        [conversationId]
    );
}

async function runTest() {
    let ownerConversationId = null;
    let unauthorizedConversationId = null;

    try {
        console.log(
            "Creating test conversations..."
        );

        ownerConversationId =
            await createTestConversation(
                USER_ID,
                "Delete Test Owner"
            );

        unauthorizedConversationId =
            await createTestConversation(
                USER_ID,
                "Delete Test Unauthorized"
            );

        await createTestMessage(
            ownerConversationId
        );

        await createTestMessage(
            unauthorizedConversationId
        );

        const ownerToken =
            createToken(USER_ID);

        console.log(
            "Deleting conversation through API..."
        );

        const deleteResponse =
            await fetch(
                `${BASE_URL}/api/ai/conversations/${ownerConversationId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization:
                            `Bearer ${ownerToken}`
                    }
                }
            );

        const deleteData =
            await deleteResponse.json();

        console.log(
            "HTTP status:",
            deleteResponse.status
        );

        console.log(
            "Response:",
            deleteData
        );

        if (
            deleteResponse.status !== 200
        ) {
            throw new Error(
                "Conversation deletion API returned an unexpected status"
            );
        }

        console.log(
            "PASS: Owner can delete conversation"
        );

        const databaseCheck =
            await pool.query(
                `
                SELECT id
                FROM ai_conversations
                WHERE id = $1
                `,
                [ownerConversationId]
            );

        if (
            databaseCheck.rows.length !== 0
        ) {
            throw new Error(
                "Conversation still exists in PostgreSQL"
            );
        }

        const messageCheck =
            await pool.query(
                `
                SELECT id
                FROM ai_messages
                WHERE conversation_id = $1
                `,
                [ownerConversationId]
            );

        if (
            messageCheck.rows.length !== 0
        ) {
            throw new Error(
                "Conversation messages were not deleted"
            );
        }

        console.log(
            "PASS: Conversation and messages deleted from PostgreSQL"
        );

        console.log(
            "Testing unauthorized deletion..."
        );

        const otherUserToken =
            createToken(999999);

        const unauthorizedResponse =
            await fetch(
                `${BASE_URL}/api/ai/conversations/${unauthorizedConversationId}`,
                {
                    method: "DELETE",
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
                "Unauthorized conversation deletion was not blocked"
            );
        }

        console.log(
            "PASS: Unauthorized deletion blocked"
        );

        const ownershipCheck =
            await pool.query(
                `
                SELECT id
                FROM ai_conversations
                WHERE id = $1
                  AND user_id = $2
                `,
                [
                    unauthorizedConversationId,
                    USER_ID
                ]
            );

        if (
            ownershipCheck.rows.length !== 1
        ) {
            throw new Error(
                "Unauthorized deletion removed the conversation"
            );
        }

        console.log(
            "PASS: Unauthorized conversation remains intact"
        );

        console.log(
            "\nConversation deletion API test passed."
        );
    } catch (error) {
        console.error(
            "\nConversation deletion API test failed:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (
            ownerConversationId !== null
        ) {
            await pool.query(
                `
                DELETE FROM ai_conversations
                WHERE id = $1
                `,
                [ownerConversationId]
            );
        }

        if (
            unauthorizedConversationId !== null
        ) {
            await pool.query(
                `
                DELETE FROM ai_conversations
                WHERE id = $1
                `,
                [unauthorizedConversationId]
            );
        }

        console.log(
            "Test conversations cleaned up."
        );

        await pool.end();
    }
}

runTest();