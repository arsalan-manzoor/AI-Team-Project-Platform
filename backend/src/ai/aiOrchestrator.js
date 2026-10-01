const modelAdapter = require("./modelAdapter");
const tools = require("./toolRegistry");
const { executeTool } = require("./toolExecutor");

const {
    createConfirmation
} = require("../services/aiConfirmation.service");

const {
    getConversation,
    getMessages,
    addMessage
} = require("../services/aiConversation.service");

const MAX_TOOL_ROUNDS = 5;

const ALLOWED_MESSAGE_ROLES = new Set([
    "system",
    "user",
    "assistant",
    "tool"
]);

function validateMessages(messages) {
    if (!Array.isArray(messages)) {
        throw new Error(
            "AI request messages must be an array"
        );
    }

    if (messages.length === 0) {
        throw new Error(
            "AI request must contain at least one message"
        );
    }

    for (const message of messages) {
        if (!message || typeof message !== "object") {
            throw new Error(
                "Each AI message must be an object"
            );
        }

        if (
            typeof message.role !== "string" ||
            !ALLOWED_MESSAGE_ROLES.has(message.role)
        ) {
            throw new Error(
                "AI message role is invalid"
            );
        }

        if (
            typeof message.content !== "string"
        ) {
            throw new Error(
                "AI message content must be a string"
            );
        }
    }
}

function validateClientMessages(messages) {
    validateMessages(messages);

    for (const message of messages) {
        if (message.role !== "user") {
            throw new Error(
                "Client AI messages must use the user role"
            );
        }
    }
}

function buildToolDefinitions() {
    return Object.values(tools).map((tool) => ({
        name: tool.name,
        type: tool.type,
        description: tool.description,
        parameters: tool.parameters,
        returns: tool.returns
    }));
}

function normalizeToolCalls(modelResponse) {
    if (
        Array.isArray(modelResponse.tool_calls) &&
        modelResponse.tool_calls.length > 0
    ) {
        return modelResponse.tool_calls;
    }

    if (modelResponse.tool_call) {
        return [modelResponse.tool_call];
    }

    return [];
}

function buildConversationMessages(
    storedMessages
) {
    return storedMessages.map((message) => {
        if (message.role === "tool") {
            return {
                role: "tool",
                content: message.content
            };
        }

        return {
            role: message.role,
            content: message.content
        };
    });
}

async function loadConversationHistory(
    conversationId,
    userId
) {
    const conversation =
        await getConversation(
            conversationId,
            userId
        );

    if (!conversation) {
        throw new Error(
            "AI conversation was not found"
        );
    }

    const storedMessages =
        await getMessages(
            conversationId,
            userId
        );

    return buildConversationMessages(
        storedMessages || []
    );
}

async function persistUserMessages({
    conversationId,
    messages
}) {
    for (const message of messages) {
        if (message.role !== "user") {
            continue;
        }

        await addMessage({
            conversationId,
            role: "user",
            content: message.content
        });
    }
}

async function createWriteConfirmation({
    toolName,
    toolArguments,
    userId,
    conversationId
}) {
    const confirmation =
        createConfirmation({
            userId,
            conversationId,
            toolName,
            toolArguments
        });

    return {
        requires_confirmation: true,
        confirmation_id:
            confirmation.confirmationId,
        tool_name:
            confirmation.toolName,
        tool_arguments:
            confirmation.toolArguments,
        message:
            `The AI wants to perform the action "${toolName}". Explicit confirmation is required before it can be executed.`
    };
}

async function runAIRequest({
    messages,
    userId,
    conversationId = null
}) {
    validateMessages(messages);

    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    if (
        conversationId !== null &&
        !Number.isInteger(conversationId)
    ) {
        throw new Error(
            "AI conversation ID must be a valid integer"
        );
    }

    const toolDefinitions =
        buildToolDefinitions();

    let conversation;

    if (conversationId !== null) {
        conversation =
            await loadConversationHistory(
                conversationId,
                userId
            );

        await persistUserMessages({
            conversationId,
            messages
        });

        conversation.push(
            ...messages
                .filter(
                    (message) =>
                        message.role === "user"
                )
                .map((message) => ({
                    role: "user",
                    content: message.content
                }))
        );
    } else {
        conversation = [...messages];
    }

    for (
        let round = 0;
        round < MAX_TOOL_ROUNDS;
        round++
    ) {
        const modelResponse =
            await modelAdapter.generateResponse({
                messages: conversation,
                tools: toolDefinitions
            });

        if (
            !modelResponse ||
            typeof modelResponse !== "object"
        ) {
            throw new Error(
                "AI model returned an invalid response"
            );
        }

        const toolCalls =
            normalizeToolCalls(modelResponse);

        if (toolCalls.length === 0) {
            const content =
                modelResponse.content || "";

            if (conversationId !== null) {
                await addMessage({
                    conversationId,
                    role: "assistant",
                    content
                });
            }

            return {
                content
            };
        }

        const assistantMessage =
            modelResponse.assistant_message || {
                role: "assistant",
                content: ""
            };

        conversation.push({
            role: "assistant",
            content:
                assistantMessage.content || "",
            tool_calls:
                assistantMessage.tool_calls || []
        });

        /*
         * Check for write tools BEFORE executing
         * any tool call.
         *
         * Write tools are never executed automatically.
         * They create a server-side confirmation instead.
         */
        for (const toolCall of toolCalls) {
            const {
                name,
                arguments: toolArguments
            } = toolCall;

            const tool = tools[name];

            if (!tool) {
                throw new Error(
                    "Unknown AI tool"
                );
            }

            if (tool.type === "write") {
                const confirmation =
                    await createWriteConfirmation({
                        toolName: name,
                        toolArguments:
                            toolArguments || {},
                        userId,
                        conversationId
                    });

                if (
                    conversationId !== null
                ) {
                    await addMessage({
                        conversationId,
                        role: "assistant",
                        content:
                            confirmation.message,
                        toolName: name,
                        toolArguments:
                            toolArguments || {},
                        toolResult:
                            confirmation
                    });
                }

                return confirmation;
            }
        }

        /*
         * Only read tools reach executeTool().
         */
        for (const toolCall of toolCalls) {
            const {
                name,
                arguments: toolArguments
            } = toolCall;

            const toolResult =
                await executeTool(
                    name,
                    toolArguments,
                    userId
                );

            if (
                conversationId !== null
            ) {
                await addMessage({
                    conversationId,
                    role: "tool",
                    content:
                        JSON.stringify(
                            toolResult
                        ),
                    toolName: name,
                    toolArguments:
                        toolArguments,
                    toolResult:
                        toolResult
                });
            }

            if (
                toolResult &&
                typeof toolResult === "object" &&
                toolResult.available === false
            ) {
                const content =
                    "No authorized information is available for the requested item.";

                if (
                    conversationId !== null
                ) {
                    await addMessage({
                        conversationId,
                        role: "assistant",
                        content
                    });
                }

                return {
                    content
                };
            }

            conversation.push({
                role: "tool",
                tool_name: name,
                content:
                    JSON.stringify(
                        toolResult
                    )
            });
        }
    }

    throw new Error(
        "AI tool execution exceeded the maximum allowed rounds"
    );
}

module.exports = {
    runAIRequest,
    buildToolDefinitions,
    validateMessages,
    validateClientMessages,
    normalizeToolCalls
};