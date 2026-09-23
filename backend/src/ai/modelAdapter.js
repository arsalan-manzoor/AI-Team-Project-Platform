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

    throw new Error(
        "AI model adapter is not configured yet"
    );
}

module.exports = {
    generateResponse
};