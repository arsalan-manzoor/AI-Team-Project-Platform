function buildAIContextContract(type, data) {
    if (data === null || data === undefined) {
        return {
            context_type: type,
            data: null,
            available: false,
            message: "No authorized context is available for this request."
        };
    }

    return {
        context_type: type,
        data,
        available: true
    };
}

module.exports = {
    buildAIContextContract
};