const {
    createConfirmation,
    getConfirmation
} = require("../src/services/aiConfirmation.service");

function assert(condition, message) {
    if (!condition) {
        throw new Error(`FAIL: ${message}`);
    }

    console.log(`PASS: ${message}`);
}

async function run() {
    console.log(
        "Creating a fresh confirmation..."
    );

    const confirmation =
        createConfirmation({
            userId: 16,
            conversationId:
                "expiry-test",
            toolName: "create_task",
            toolArguments: {
                title:
                    "Expiry Test Task",
                project_id: 6
            }
        });

    assert(
        confirmation &&
            confirmation.confirmationId,
        "Confirmation created"
    );

    const activeConfirmation =
        getConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        activeConfirmation !== null,
        "Fresh confirmation is available"
    );

    console.log(
        "Simulating an expired confirmation..."
    );

    const originalCreatedAt =
        confirmation.createdAt;

    const expiredTimestamp =
        new Date(
            Date.now() -
                6 * 60 * 1000
        ).toISOString();

    confirmation.createdAt =
        expiredTimestamp;

    const expiredConfirmation =
        getConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        expiredConfirmation === null,
        "Expired confirmation is rejected"
    );

    const reusedConfirmation =
        getConfirmation(
            confirmation.confirmationId,
            16
        );

    assert(
        reusedConfirmation === null,
        "Expired confirmation is removed and cannot be reused"
    );

    confirmation.createdAt =
        originalCreatedAt;

    console.log(
        "Confirmation expiry evaluation passed."
    );
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});