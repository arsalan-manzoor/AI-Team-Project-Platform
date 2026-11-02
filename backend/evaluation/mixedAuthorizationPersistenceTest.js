require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const pool = require("../src/config/db");
const modelAdapter = require("../src/ai/modelAdapter");
const { runAIRequest } = require("../src/ai/aiOrchestrator");
const { isDeepStrictEqual } = require("node:util");

const {
    createConversation,
    getMessages,
    deleteConversation
} = require("../src/services/aiConversation.service");

async function runTest() {
    let conversationId = null;

    const originalGenerateResponse =
        modelAdapter.generateResponse;

    try {
        const userId = 6;

        console.log("Creating test conversation...");

        const conversation = await createConversation(
            userId,
            "Mixed Authorization Persistence Test"
        );

        conversationId = conversation.id;

        if (!conversationId) {
            throw new Error("Conversation creation failed");
        }

        console.log("PASS: Conversation created");

        let responseIndex = 0;

        modelAdapter.generateResponse = async function () {
            responseIndex++;

            if (responseIndex === 1) {
                return {
                    tool_calls: [
                        {
                            name: "get_project",
                            arguments: {
                                project_id: 1
                            }
                        },
                        {
                            name: "get_project",
                            arguments: {
                                project_id: 2
                            }
                        }
                    ],
                    assistant_message: {
                        role: "assistant",
                        content: ""
                    }
                };
            }

            if (responseIndex === 2) {
                return {
                    content: "Authorized project data retrieved"
                };
            }

            throw new Error("Unexpected model response");
        };

        console.log("Executing mixed-authorization request...");

        const result = await runAIRequest({
            messages: [
                {
                    role: "user",
                    content: "Retrieve project information"
                }
            ],
            userId: userId,
            conversationId: conversationId
        });

        if (
            !result ||
            result.content !== "Authorized project data retrieved"
        ) {
            throw new Error("Unexpected final AI response");
        }

        console.log("PASS: AI request completed");

        const messages = await getMessages(
            conversationId,
            userId
        );

        const toolMessages = messages.filter(function (message) {
            return message.role === "tool";
        });

        if (toolMessages.length !== 2) {
            throw new Error(
                "Expected 2 stored tool messages, received " +
                String(toolMessages.length)
            );
        }

        console.log("PASS: Both tool results were persisted");

        const parsedMessages = toolMessages.map(function (message) {
            return {
                message: message,
                contentResult: JSON.parse(message.content),
                storedResult:
                    typeof message.tool_result === "string"
                        ? JSON.parse(message.tool_result)
                        : message.tool_result
            };
        });

        const unauthorizedEntry = parsedMessages.find(
            function (entry) {
                return (
                    entry.contentResult &&
                    entry.contentResult.available === false
                );
            }
        );

        if (!unauthorizedEntry) {
            throw new Error(
                "Expected a sanitized unauthorized tool result"
            );
        }

        const expectedSafeResult = {
            available: false,
            message:
                "No authorized information is available for the requested item."
        };

        if (
            !isDeepStrictEqual(
                unauthorizedEntry.contentResult,
                expectedSafeResult
            )
        ) {
            throw new Error(
                "Unauthorized message content was not sanitized"
            );
        }

        console.log(
            "PASS: Unauthorized message content is sanitized"
        );

        const storedUnauthorizedResult =
            unauthorizedEntry.storedResult;

        if (
            !storedUnauthorizedResult ||
            storedUnauthorizedResult.available !== false ||
            storedUnauthorizedResult.message !==
                expectedSafeResult.message ||
            Object.keys(storedUnauthorizedResult).length !== 2
        ) {
            throw new Error(
                "Unauthorized tool_result was not sanitized"
            );
        }

        console.log(
            "PASS: Unauthorized tool_result is sanitized"
        );

        const unauthorizedStoredText = JSON.stringify({
            content: unauthorizedEntry.message.content,
            toolResult: storedUnauthorizedResult
        });

        if (
            unauthorizedStoredText.includes("project_id") ||
            unauthorizedStoredText.includes("project_name")
        ) {
            throw new Error(
                "Restricted project details were found in the stored unauthorized result"
            );
        }

        console.log(
            "PASS: No restricted project details in unauthorized stored results"
        );

        const authorizedEntry = parsedMessages.find(
            function (entry) {
                return (
                    entry.contentResult &&
                    entry.contentResult.available !== false
                );
            }
        );

        if (!authorizedEntry) {
            throw new Error(
                "Authorized project result was not preserved"
            );
        }

        if (
            !isDeepStrictEqual(
                authorizedEntry.storedResult,
                authorizedEntry.contentResult
            )
        ) {
            throw new Error(
                "Authorized content and stored tool_result do not match"
            );
        }

        console.log(
            "PASS: Authorized project result remains available"
        );

        console.log(
            "\nMixed authorization persistence test passed."
        );
    } catch (error) {
        console.error(
            "\nMixed authorization persistence test failed:"
        );
        console.error(error.stack || error.message);
        process.exitCode = 1;
    } finally {
        modelAdapter.generateResponse =
            originalGenerateResponse;

        if (conversationId !== null) {
            try {
                await deleteConversation(conversationId, 6);
                console.log("Test conversation cleaned up.");
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up test conversation:",
                    cleanupError.message
                );
                process.exitCode = 1;
            }
        }

        try {
            await pool.end();
        } catch (poolError) {
            console.error(
                "Failed to close database connection:",
                poolError.message
            );
            process.exitCode = 1;
        }
    }
}

runTest();