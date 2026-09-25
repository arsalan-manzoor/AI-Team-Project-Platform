const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const modelAdapter = require("../src/ai/modelAdapter");
const { runAIRequest } = require("../src/ai/aiOrchestrator");

const cases = [
    {
        name: "authorized_project_access",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "get_project",
                    arguments: {
                        project_id: 2
                    }
                },
                assistant_message: {
                    role: "assistant",
                    content: ""
                }
            },
            {
                content: "Project data retrieved"
            }
        ],
        expected_content: "Project data retrieved",
        expected_tool_data: true
    },

    {
        name: "unauthorized_project_access",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "get_project",
                    arguments: {
                        project_id: 1
                    }
                },
                assistant_message: {
                    role: "assistant",
                    content: ""
                }
            },
            {
                content: "Project data retrieved"
            }
        ],
        expected_content: "Project data retrieved",
        expected_tool_data: false
    },

    {
        name: "authorized_project_list",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "get_projects",
                    arguments: {}
                },
                assistant_message: {
                    role: "assistant",
                    content: ""
                }
            },
            {
                content: "Project list retrieved"
            }
        ],
        expected_content: "Project list retrieved"
    },

    {
        name: "missing_required_project_id",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "get_project",
                    arguments: {}
                }
            }
        ],
        expected_error:
            "Missing required AI tool argument: project_id"
    },

    {
        name: "invalid_project_id_type",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "get_project",
                    arguments: {
                        project_id: "abc"
                    }
                }
            }
        ],
        expected_error:
            'AI tool argument "project_id" must be a valid integer'
    },

    {
        name: "invalid_user_id",
        user_id: null,
        model_responses: [
            {
                tool_call: {
                    name: "get_projects",
                    arguments: {}
                }
            }
        ],
        expected_error:
            "Authenticated user ID must be a valid integer"
    },

    {
        name: "unknown_tool",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    name: "delete_everything",
                    arguments: {}
                }
            }
        ],
        expected_error: "Unknown AI tool"
    },

    {
        name: "normal_response",
        user_id: 6,
        model_responses: [
            {
                content: "Normal AI response"
            }
        ],
        expected_content: "Normal AI response"
    },

    {
        name: "invalid_tool_call_structure",
        user_id: 6,
        model_responses: [
            {
                tool_call: {
                    arguments: {
                        project_id: 2
                    }
                }
            }
        ],
        expected_error: "Unknown AI tool"
    }
];

async function runCase(testCase) {
    let responseIndex = 0;

    modelAdapter.generateResponse = async function ({
        messages
    }) {
        if (
            testCase.expected_tool_data !== undefined &&
            responseIndex === 1
        ) {
            const toolMessage =
                messages[messages.length - 1];

            if (
                !toolMessage ||
                toolMessage.role !== "tool"
            ) {
                throw new Error(
                    "Expected tool result message was not added to the conversation"
                );
            }

            let toolResult;

            try {
                toolResult =
                    JSON.parse(toolMessage.content);
            } catch (error) {
                throw new Error(
                    "Tool result message contains invalid JSON"
                );
            }

            const hasToolData =
                toolResult &&
                Object.prototype.hasOwnProperty.call(
                    toolResult,
                    "data"
                )
                    ? toolResult.data !== null
                    : toolResult !== null;

            if (
                hasToolData !==
                testCase.expected_tool_data
            ) {
                throw new Error(
                    "Unexpected tool result authorization state"
                );
            }
        }

        const response =
            testCase.model_responses[responseIndex];

        responseIndex++;

        return response;
    };

    try {
        const result = await runAIRequest({
            messages: [
                {
                    role: "user",
                    content: "Test AI tool call"
                }
            ],
            userId: testCase.user_id
        });

        if (testCase.expected_content) {
            const passed =
                result.content === testCase.expected_content;

            console.log(
                (passed ? "PASS" : "FAIL") +
                ": " +
                testCase.name
            );

            if (!passed) {
                console.log(
                    "  Reason: " +
                    result.content
                );
            }

            return passed;
        }

        if (testCase.expected_error) {
            console.log("FAIL: " + testCase.name);
            console.log(
                "  Reason: tool executed when it should have been rejected"
            );
            return false;
        }

        return false;
    } catch (error) {
        if (testCase.expected_error) {
            const passed =
                error.message === testCase.expected_error;

            console.log(
                (passed ? "PASS" : "FAIL") +
                ": " +
                testCase.name
            );

            if (!passed) {
                console.log(
                    "  Reason: " +
                    error.message
                );
            }

            return passed;
        }

        console.log("FAIL: " + testCase.name);
        console.log("  Reason: " + error.message);

        return false;
    }
}

async function runEvaluation() {
    let passed = 0;

    for (const testCase of cases) {
        if (await runCase(testCase)) {
            passed++;
        }
    }

    console.log("");

    console.log(
        "Orchestrator evaluation: " +
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