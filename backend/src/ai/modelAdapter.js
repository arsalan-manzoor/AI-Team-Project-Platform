const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL_NAME = "qwen2.5:3b";
const REQUEST_TIMEOUT_MS = 120000;

const AI_SYSTEM_INSTRUCTION =
    "You are the ZYRA AI assistant. " +
    "Use only information returned by authorized tools. " +
    "Never guess, speculate, or invent project, task, team, user, or permission information. " +
    "If a tool result contains available=false, do not speculate about deletion, visibility, authentication, or why the data is unavailable. " +
    "Simply tell the user that no authorized information is available for the requested item. " +
    "Do not reveal whether an inaccessible item exists.";

function convertToolDefinition(tool) {
    const properties = {};

    for (const [name, definition] of Object.entries(
        tool.parameters || {}
    )) {
        properties[name] = {
            type: definition.type
        };
    }

    const required = Object.entries(
        tool.parameters || {}
    )
        .filter(([, definition]) => definition.required)
        .map(([name]) => name);

    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: "object",
                properties,
                required,
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
            Array.isArray(data.message.tool_calls) &&
            data.message.tool_calls.length > 0
        ) {
            const toolCall =
                data.message.tool_calls[0];

            if (
                !toolCall ||
                typeof toolCall !== "object" ||
                !toolCall.function ||
                typeof toolCall.function !== "object"
            ) {
                throw new Error(
                    "Ollama returned an invalid tool call"
                );
            }

            const normalizedToolCall = {
                name: toolCall.function.name,
                arguments:
                    toolCall.function.arguments
            };

            validateToolCall(
                normalizedToolCall
            );

            return {
                tool_call: normalizedToolCall,
                assistant_message: data.message
            };
        }

        return {
            content:
                typeof data.message.content ===
                "string"
                    ? data.message.content
                    : "",
            assistant_message: data.message
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