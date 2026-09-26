const { validateMessages } = require("../src/ai/aiOrchestrator");

const cases = [
    {
        name: "valid_messages",
        messages: [
            {
                role: "user",
                content: "Hello"
            }
        ],
        expected_error: null
    },

    {
        name: "empty_messages",
        messages: [],
        expected_error:
            "AI request must contain at least one message"
    },

    {
        name: "invalid_message_object",
        messages: [
            null
        ],
        expected_error:
            "Each AI message must be an object"
    },

    {
        name: "invalid_message_role",
        messages: [
            {
                role: "invalid",
                content: "Hello"
            }
        ],
        expected_error:
            "AI message role is invalid"
    },

    {
        name: "missing_message_role",
        messages: [
            {
                content: "Hello"
            }
        ],
        expected_error:
            "AI message role is invalid"
    },

    {
        name: "invalid_message_content",
        messages: [
            {
                role: "user",
                content: 123
            }
        ],
        expected_error:
            "AI message content must be a string"
    }
];

function runEvaluation() {
    let passed = 0;

    for (const testCase of cases) {
        try {
            validateMessages(testCase.messages);

            if (testCase.expected_error === null) {
                console.log("PASS: " + testCase.name);
                passed++;
            } else {
                console.log("FAIL: " + testCase.name);
                console.log(
                    "  Reason: expected validation error"
                );
            }
        } catch (error) {
            if (
                error.message ===
                testCase.expected_error
            ) {
                console.log("PASS: " + testCase.name);
                passed++;
            } else {
                console.log("FAIL: " + testCase.name);
                console.log(
                    "  Reason: " + error.message
                );
            }
        }
    }

    console.log("");

    console.log(
        "Message validation evaluation: " +
        passed +
        "/" +
        cases.length +
        " cases passed"
    );

    if (passed !== cases.length) {
        process.exitCode = 1;
    }
}

runEvaluation();