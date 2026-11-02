const {
    createConfirmation,
    getConfirmation,
    consumeConfirmation
} = require("../src/services/aiConfirmation.service");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function main() {
    const confirmation =
        createConfirmation({
            userId: 16,
            conversationId: 28,
            toolName: "create_task",
            toolArguments: {
                title: "Test task",
                project_id: 6
            }
        });

    assert(
        confirmation &&
        confirmation.confirmationId,
        "Confirmation was not created"
    );

    const ownerConfirmation =
        getConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        ownerConfirmation !== null,
        "Owner could not retrieve confirmation"
    );

    const unauthorizedConfirmation =
        getConfirmation(
            confirmation.confirmationId,
            99
        );

    assert(
        unauthorizedConfirmation === null,
        "Unauthorized user retrieved confirmation"
    );

    const consumed =
        consumeConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        consumed !== null,
        "Owner could not consume confirmation"
    );

    const consumedAgain =
        getConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        consumedAgain === null,
        "Confirmation remained available after consumption"
    );

    console.log(
        "PASS: confirmation ownership and single-use behavior"
    );
    console.log(
        "Evaluation: 1/1 cases passed"
    );
}

try {
    main();
} catch (error) {
    console.error(
        "FAIL:",
        error.message
    );
    process.exit(1);
}