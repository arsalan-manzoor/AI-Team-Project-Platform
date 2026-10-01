const pool = require("../config/db");

async function createConversation(userId, title = null) {
    const result = await pool.query(
        `
        INSERT INTO ai_conversations (
            user_id,
            title
        )
        VALUES ($1, $2)
        RETURNING
            id,
            user_id,
            title,
            created_at,
            updated_at
        `,
        [userId, title]
    );

    return result.rows[0];
}

async function getConversation(
    conversationId,
    userId
) {
    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            title,
            created_at,
            updated_at
        FROM ai_conversations
        WHERE id = $1
          AND user_id = $2
        `,
        [conversationId, userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

async function getConversations(userId) {
    const result = await pool.query(
        `
        SELECT
            id,
            user_id,
            title,
            created_at,
            updated_at
        FROM ai_conversations
        WHERE user_id = $1
        ORDER BY updated_at DESC, id DESC
        `,
        [userId]
    );

    return result.rows;
}

async function addMessage({
    conversationId,
    role,
    content,
    toolName = null,
    toolArguments = null,
    toolResult = null
}) {
    const result = await pool.query(
        `
        INSERT INTO ai_messages (
            conversation_id,
            role,
            content,
            tool_name,
            tool_arguments,
            tool_result
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id,
            conversation_id,
            role,
            content,
            tool_name,
            tool_arguments,
            tool_result,
            created_at
        `,
        [
            conversationId,
            role,
            content,
            toolName,
            toolArguments,
            toolResult
        ]
    );

    await pool.query(
        `
        UPDATE ai_conversations
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [conversationId]
    );

    return result.rows[0];
}

async function getMessages(
    conversationId,
    userId
) {
    const conversation =
        await getConversation(
            conversationId,
            userId
        );

    if (!conversation) {
        return null;
    }

    const result = await pool.query(
        `
        SELECT
            id,
            conversation_id,
            role,
            content,
            tool_name,
            tool_arguments,
            tool_result,
            created_at
        FROM ai_messages
        WHERE conversation_id = $1
        ORDER BY id ASC
        `,
        [conversationId]
    );

    return result.rows;
}

async function deleteConversation(
    conversationId,
    userId
) {
    const result = await pool.query(
        `
        DELETE FROM ai_conversations
        WHERE id = $1
          AND user_id = $2
        RETURNING
            id,
            user_id,
            title
        `,
        [
            conversationId,
            userId
        ]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

module.exports = {
    createConversation,
    getConversation,
    getConversations,
    addMessage,
    getMessages,
    deleteConversation
};