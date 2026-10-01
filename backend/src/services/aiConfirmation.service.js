const pendingConfirmations = new Map();

function createConfirmation({
    userId,
    conversationId = null,
    toolName,
    toolArguments
}) {
    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    if (typeof toolName !== "string" || !toolName) {
        throw new Error(
            "AI confirmation tool name is required"
        );
    }

    const confirmationId =
        `${userId}:${conversationId || "none"}:${Date.now()}:${Math.random()
            .toString(36)
            .slice(2)}`;

    const confirmation = {
        confirmationId,
        userId,
        conversationId,
        toolName,
        toolArguments,
        createdAt: new Date().toISOString()
    };

    pendingConfirmations.set(
        confirmationId,
        confirmation
    );

    return confirmation;
}

function getConfirmation(
    confirmationId,
    userId
) {
    const confirmation =
        pendingConfirmations.get(
            confirmationId
        );

    if (!confirmation) {
        return null;
    }

    if (
        confirmation.userId !== userId
    ) {
        return null;
    }

    return confirmation;
}

function consumeConfirmation(
    confirmationId,
    userId
) {
    const confirmation =
        getConfirmation(
            confirmationId,
            userId
        );

    if (!confirmation) {
        return null;
    }

    pendingConfirmations.delete(
        confirmationId
    );

    return confirmation;
}

function deleteConfirmation(
    confirmationId,
    userId
) {
    const confirmation =
        getConfirmation(
            confirmationId,
            userId
        );

    if (!confirmation) {
        return false;
    }

    pendingConfirmations.delete(
        confirmationId
    );

    return true;
}

module.exports = {
    createConfirmation,
    getConfirmation,
    consumeConfirmation,
    deleteConfirmation
};