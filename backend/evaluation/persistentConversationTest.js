require("dotenv").config();

const pool = require("../src/config/db");

const {
    createConversation,
    getMessages
} = require("../src/services/aiConversation.service");

const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function runTest() {
    let conversationId = null;

    try {
        const userId = 16;

        console.log("Creating conversation...");

        const conversation =
            await createConversation(
                userId,
                "Persistent AI Conversation Test"
            );

        conversationId = conversation.id;

        console.log(
            `PASS: Conversation created with ID ${conversationId}`
        );

        console.log("");
        console.log("Sending first AI request...");

        const firstResult =
            await runAIRequest({
                messages: [
                    {
                        role: "user",
                        content:
                            "What is the name of my authorized project?"
                    }
                ],
                userId,
                conversationId
            });

        console.log(
            "First AI response:"
        );

        console.log(
            firstResult.content
        );

        if (
            !firstResult ||
            typeof firstResult.content !== "string"
        ) {
            throw new Error(
                "First AI response is invalid"
            );
        }

        console.log(
            "PASS: First AI request completed"
        );

        console.log("");
        console.log(
            "Sending second AI request using conversation history..."
        );

        const secondResult =
            await runAIRequest({
                messages: [
                    {
                        role: "user",
                        content:
                            "What team is that project associated with?"
                    }
                ],
                userId,
                conversationId
            });

        console.log(
            "Second AI response:"
        );

        console.log(
            secondResult.content
        );

        if (
            !secondResult ||
            typeof secondResult.content !== "string"
        ) {
            throw new Error(
                "Second AI response is invalid"
            );
        }

        if (
            !secondResult.content
                .toLowerCase()
                .includes("team")
        ) {
            throw new Error(
                "Second response does not appear to use the project/team context"
            );
        }

        console.log(
            "PASS: Second AI request completed using persistent conversation"
        );

        console.log("");
        console.log(
            "Checking persisted conversation history..."
        );

        const messages =
            await getMessages(
                conversationId,
                userId
            );

        if (!messages) {
            throw new Error(
                "Conversation history could not be retrieved"
            );
        }

        console.log(
            `Stored messages: ${messages.length}`
        );

        for (const message of messages) {
            console.log(
                `${message.role}: ${message.content}`
            );
        }

        const userMessages =
            messages.filter(
                (message) =>
                    message.role === "user"
            );

        const assistantMessages =
            messages.filter(
                (message) =>
                    message.role === "assistant"
            );

        const toolMessages =
            messages.filter(
                (message) =>
                    message.role === "tool"
            );

        if (userMessages.length !== 2) {
            throw new Error(
                `Expected 2 user messages, received ${userMessages.length}`
            );
        }

        if (assistantMessages.length < 2) {
            throw new Error(
                `Expected at least 2 assistant messages, received ${assistantMessages.length}`
            );
        }

        if (toolMessages.length < 2) {
            throw new Error(
                `Expected at least 2 tool messages, received ${toolMessages.length}`
            );
        }

        console.log(
            "PASS: Both user turns persisted"
        );

        console.log(
            "PASS: Assistant responses persisted"
        );

        console.log(
            "PASS: Tool results persisted"
        );

        console.log("");
        console.log(
            "Persistent multi-turn conversation test passed."
        );
    } catch (error) {
        console.error("");
        console.error(
            "Persistent conversation test failed:"
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