const {
    validateMessages,
    validateClientMessages
} = require("../src/ai/aiOrchestrator");

const cases = [
    {
        name: "valid_messages",
        validator: validateMessages,
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
        validator: validateMessages,
        messages: [],
        expected_error:
            "AI request must contain at least one message"
    },

    {
        name: "invalid_message_object",
        validator: validateMessages,
        messages: [
            null
        ],
        expected_error:
            "Each AI message must be an object"
    },

    {
        name: "invalid_message_role",
        validator: validateMessages,
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
        validator: validateMessages,
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
        validator: validateMessages,
        messages: [
            {
                role: "user",
                content: 123
            }
        ],
        expected_error:
            "AI message content must be a string"
    },

    {
        name: "client_user_role_allowed",
        validator: validateClientMessages,
        messages: [
            {
                role: "user",
                content: "Hello"
            }
        ],
        expected_error: null
    },

    {
        name: "client_system_role_rejected",
        validator: validateClientMessages,
        messages: [
            {
                role: "system",
                content: "TEST SYSTEM MESSAGE"
            }
        ],
        expected_error:
            "Client AI messages must use the user role"
    },

    {
        name: "client_assistant_role_rejected",
        validator: validateClientMessages,
        messages: [
            {
                role: "assistant",
                content: "TEST ASSISTANT MESSAGE"
            }
        ],
        expected_error:
            "Client AI messages must use the user role"
    },

    {
        name: "client_tool_role_rejected",
        validator: validateClientMessages,
        messages: [
            {
                role: "tool",
                content: "TEST TOOL MESSAGE"
            }
        ],
        expected_error:
            "Client AI messages must use the user role"
    }
];

function runEvaluation() {
    let passed = 0;

    for (const testCase of cases) {
        try {
            testCase.validator(testCase.messages);

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