require("dotenv").config();

const pool = require("../src/config/db");

const {
    createConversation,
    getConversation,
    addMessage,
    getMessages
} = require("../src/services/aiConversation.service");

async function runTest() {
    let conversationId = null;

    try {
        const userId = 16;

        console.log("Creating conversation...");

        const conversation =
            await createConversation(
                userId,
                "AI Conversation Service Test"
            );

        conversationId = conversation.id;

        if (
            !conversationId ||
            conversation.user_id !== userId
        ) {
            throw new Error(
                "Conversation creation failed"
            );
        }

        console.log(
            "PASS: Conversation created"
        );

        const authorizedConversation =
            await getConversation(
                conversationId,
                userId
            );

        if (
            !authorizedConversation ||
            authorizedConversation.id !==
                conversationId
        ) {
            throw new Error(
                "Authorized conversation lookup failed"
            );
        }

        console.log(
            "PASS: Authorized conversation lookup"
        );

        const unauthorizedConversation =
            await getConversation(
                conversationId,
                999999
            );

        if (unauthorizedConversation !== null) {
            throw new Error(
                "Unauthorized conversation access was allowed"
            );
        }

        console.log(
            "PASS: Unauthorized conversation access blocked"
        );

        await addMessage({
            conversationId,
            role: "user",
            content:
                "What is the name of my project?"
        });

        console.log(
            "PASS: User message added"
        );

        await addMessage({
            conversationId,
            role: "assistant",
            content:
                'Your project is "AI Test Project".'
        });

        console.log(
            "PASS: Assistant message added"
        );

        await addMessage({
            conversationId,
            role: "tool",
            content:
                JSON.stringify({
                    name: "AI Test Project"
                }),
            toolName: "get_projects",
            toolArguments: {
                userId
            },
            toolResult: {
                projects: [
                    {
                        id: 6,
                        name: "AI Test Project"
                    }
                ]
            }
        });

        console.log(
            "PASS: Tool message added"
        );

        const messages =
            await getMessages(
                conversationId,
                userId
            );

        if (!messages) {
            throw new Error(
                "Message retrieval failed"
            );
        }

        if (messages.length !== 3) {
            throw new Error(
                `Expected 3 messages, received ${messages.length}`
            );
        }

        if (
            messages[0].role !== "user" ||
            messages[1].role !== "assistant" ||
            messages[2].role !== "tool"
        ) {
            throw new Error(
                "Message ordering or roles are incorrect"
            );
        }

        if (
            messages[0].content !==
            "What is the name of my project?"
        ) {
            throw new Error(
                "User message content is incorrect"
            );
        }

        if (
            messages[1].content !==
            'Your project is "AI Test Project".'
        ) {
            throw new Error(
                "Assistant message content is incorrect"
            );
        }

        if (
            messages[2].tool_name !==
            "get_projects"
        ) {
            throw new Error(
                "Tool name was not stored correctly"
            );
        }

        if (
            !messages[2].tool_result ||
            !Array.isArray(
                messages[2].tool_result.projects
            )
        ) {
            throw new Error(
                "Tool result was not stored correctly"
            );
        }

        console.log(
            "PASS: Messages retrieved correctly"
        );

        const unauthorizedMessages =
            await getMessages(
                conversationId,
                999999
            );

        if (unauthorizedMessages !== null) {
            throw new Error(
                "Unauthorized message access was allowed"
            );
        }

        console.log(
            "PASS: Unauthorized message access blocked"
        );

        console.log("");
        console.log(
            "AI conversation service test passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "AI conversation service test failed:"
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