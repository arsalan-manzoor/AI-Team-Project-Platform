const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL_NAME = "qwen2.5:3b";
const REQUEST_TIMEOUT_MS = 120000;

const AI_SYSTEM_INSTRUCTION =
    "You are the ZYRA AI assistant. " +
    "Use only information returned by authorized tools. " +
    "Never guess, speculate, invent, fabricate, or assume IDs, names, dates, or other database values. " +
    "When a tool requires an ID and the user has not explicitly provided that ID, you MUST use an appropriate authorized read tool to resolve the ID before attempting the write. " +
    "For example, if the user asks to create a task in a project by project name, first use get_projects to find the matching project and obtain its actual project_id. " +
    "Never invent a project_id, task_id, team_id, milestone_id, resource_id, or user ID. " +
    "If an appropriate read tool cannot resolve the required identifier, do not attempt the write. " +
    "When a write action depends on information returned by a previous tool call, use the exact identifier and values returned by that tool. " +
    "Use only information returned by authorized tools when answering questions or preparing write actions. " +
    "When a tool returns available=true, treat the returned data as authoritative and use the exact values from that data in your answer or subsequent tool call. " +
    "For example, if a team tool returns team.name, use that exact team name; never replace it with a generic name such as 'default', 'not provided', or 'unknown'. " +
    "If a tool returns information about multiple entities, keep each entity's ID, name, and other fields associated with the correct entity. " +
    "If the requested information is present in a successful tool result, do not claim that it is missing or not provided. " +
    "If a tool result contains available=false, do not speculate about deletion, visibility, authentication, or why the data is unavailable. " +
    "Simply tell the user that no authorized information is available for the requested item. " +
    "Do not reveal whether an inaccessible item exists. " +
    "For write actions, confirmation is handled by the server. Never claim that a write has already been executed merely because a write tool was selected.";

function convertToolDefinition(tool) {
    const properties = {};

    for (const [name, definition] of Object.entries(
        tool.parameters || {}
    )) {
        const property = {
            type: definition.type
        };

        if (
            definition.type === "array" &&
            definition.items
        ) {
            property.items = {
                type: definition.items.type
            };
        }

        properties[name] = property;
    }

    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: "object",
                properties,
                required: Object.entries(
                    tool.parameters || {}
                )
                    .filter(
                        ([, definition]) =>
                            definition.required === true
                    )
                    .map(([name]) => name),
                additionalProperties: false
            }
        }
    };
}

function validateToolCall(toolCall) {
    if (
        !toolCall ||
        typeof toolCall !== "object"
    ) {
        throw new Error(
            "Ollama returned an invalid tool call"
        );
    }

    if (
        typeof toolCall.name !== "string" ||
        toolCall.name.length === 0
    ) {
        throw new Error(
            "Ollama returned an invalid tool name"
        );
    }

    if (
        toolCall.arguments === null ||
        typeof toolCall.arguments !== "object" ||
        Array.isArray(toolCall.arguments)
    ) {
        throw new Error(
            "Ollama returned invalid tool arguments"
        );
    }
}

async function generateResponse({
    messages,
    tools
}) {
    if (!Array.isArray(messages)) {
        throw new Error(
            "Model adapter messages must be an array"
        );
    }

    if (!Array.isArray(tools)) {
        throw new Error(
            "Model adapter tools must be an array"
        );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
        const modelMessages = [
            {
                role: "system",
                content: AI_SYSTEM_INSTRUCTION
            },
            ...messages
        ];

        const response = await fetch(
            OLLAMA_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: MODEL_NAME,
                    messages: modelMessages,
                    tools: tools.map(
                        convertToolDefinition
                    ),
                    stream: false
                }),
                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `Ollama request failed with status ${response.status}`
            );
        }

        const data = await response.json();

        if (
            !data ||
            !data.message ||
            typeof data.message !== "object"
        ) {
            throw new Error(
                "Ollama returned an invalid response"
            );
        }

        if (
            Array.isArray(
                data.message.tool_calls
            ) &&
            data.message.tool_calls.length > 0
        ) {
            const normalizedToolCalls =
                data.message.tool_calls.map(
                    (toolCall) => {
                        if (
                            !toolCall ||
                            typeof toolCall !==
                                "object" ||
                            !toolCall.function ||
                            typeof toolCall.function !==
                                "object"
                        ) {
                            throw new Error(
                                "Ollama returned an invalid tool call"
                            );
                        }

                        const normalizedToolCall = {
                            name:
                                toolCall.function
                                    .name,
                            arguments:
                                toolCall.function
                                    .arguments
                        };

                        validateToolCall(
                            normalizedToolCall
                        );

                        return normalizedToolCall;
                    }
                );

            return {
                tool_calls:
                    normalizedToolCalls,
                assistant_message:
                    data.message
            };
        }

        return {
            content:
                typeof data.message.content ===
                "string"
                    ? data.message.content
                    : "",
            assistant_message:
                data.message
        };
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(
                "Ollama request timed out"
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    generateResponse,
    convertToolDefinition,
    validateToolCall
};