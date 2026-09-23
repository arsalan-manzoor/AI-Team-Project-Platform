const modelAdapter = require("./modelAdapter");
const tools = require("./toolRegistry");
const { executeTool } = require("./toolExecutor");

function buildToolDefinitions() {
    return Object.values(tools).map((tool) => ({
        name: tool.name,
        type: tool.type,
        description: tool.description,
        parameters: tool.parameters,
        returns: tool.returns
    }));
}

async function runAIRequest({
    messages,
    userId
}) {
    if (!Array.isArray(messages)) {
        throw new Error(
            "AI request messages must be an array"
        );
    }

    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    const toolDefinitions = buildToolDefinitions();

    const modelResponse = await modelAdapter.generateResponse({
        messages,
        tools: toolDefinitions
    });

    if (!modelResponse || typeof modelResponse !== "object") {
        throw new Error(
            "AI model returned an invalid response"
        );
    }

    if (!modelResponse.tool_call) {
        return modelResponse;
    }

    const {
        name,
        arguments: toolArguments
    } = modelResponse.tool_call;

    const toolResult = await executeTool(
        name,
        toolArguments,
        userId
    );

    return {
        model_response: modelResponse,
        tool_result: toolResult
    };
}

module.exports = {
    runAIRequest,
    buildToolDefinitions
};