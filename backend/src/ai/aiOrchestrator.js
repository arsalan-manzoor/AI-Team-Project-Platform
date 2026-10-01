const modelAdapter = require("./modelAdapter");
const tools = require("./toolRegistry");
const { executeTool } = require("./toolExecutor");

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

async function runAIRequest({
    messages,
    userId
}) {
    validateMessages(messages);

    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    const toolDefinitions =
        buildToolDefinitions();

    const conversation = [...messages];

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
            return {
                content:
                    modelResponse.content || ""
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
                toolResult &&
                typeof toolResult === "object" &&
                toolResult.available === false
            ) {
                return {
                    content:
                        "No authorized information is available for the requested item."
                };
            }

            conversation.push({
                role: "tool",
                tool_name: name,
                content:
                    JSON.stringify(toolResult)
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