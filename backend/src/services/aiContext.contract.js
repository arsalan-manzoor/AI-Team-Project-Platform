function buildAIContextContract(type, data) {
    return {
        context_type: type,
        data: data
    };
}

module.exports = {
    buildAIContextContract
};