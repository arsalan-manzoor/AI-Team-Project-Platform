const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL_NAME = "qwen2.5:3b";

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

    const response = await fetch(
        OLLAMA_URL,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages,
                tools: tools.map(convertToolDefinition),
                stream: false
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Ollama request failed with status ${response.status}`
        );
    }

    const data = await response.json();

    if (!data.message) {
        throw new Error(
            "Ollama returned an invalid response"
        );
    }

    if (
        Array.isArray(data.message.tool_calls) &&
        data.message.tool_calls.length > 0
    ) {
        return {
            tool_call: {
                name: data.message.tool_calls[0].function.name,
                arguments:
                    data.message.tool_calls[0].function.arguments
            },
            assistant_message: data.message
        };
    }

    return {
        content: data.message.content || "",
        assistant_message: data.message
    };
}

module.exports = {
    generateResponse
};