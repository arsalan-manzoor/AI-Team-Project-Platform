const {
    validateToolCall
} = require("../src/ai/modelAdapter");

const cases = [
    {
        name: "valid_tool_call",
        tool_call: {
            name: "get_project",
            arguments: {
                project_id: 6
            }
        },
        expected_error: null
    },

    {
        name: "missing_tool_call",
        tool_call: null,
        expected_error:
            "Ollama returned an invalid tool call"
    },

    {
        name: "missing_tool_name",
        tool_call: {
            arguments: {
                project_id: 6
            }
        },
        expected_error:
            "Ollama returned an invalid tool name"
    },

    {
        name: "invalid_tool_name",
        tool_call: {
            name: "",
            arguments: {}
        },
        expected_error:
            "Ollama returned an invalid tool name"
    },

    {
        name: "missing_tool_arguments",
        tool_call: {
            name: "get_project"
        },
        expected_error:
            "Ollama returned invalid tool arguments"
    },

    {
        name: "invalid_tool_arguments",
        tool_call: {
            name: "get_project",
            arguments: []
        },
        expected_error:
            "Ollama returned invalid tool arguments"
    },

    {
        name: "null_tool_arguments",
        tool_call: {
            name: "get_project",
            arguments: null
        },
        expected_error:
            "Ollama returned invalid tool arguments"
    }
];

function runEvaluation() {
    let passed = 0;

    for (const testCase of cases) {
        try {
            validateToolCall(
                testCase.tool_call
            );

            if (testCase.expected_error === null) {
                console.log(
                    "PASS: " + testCase.name
                );
                passed++;
            } else {
                console.log(
                    "FAIL: " + testCase.name
                );
                console.log(
                    "  Reason: expected validation error"
                );
            }
        } catch (error) {
            if (
                error.message ===
                testCase.expected_error
            ) {
                console.log(
                    "PASS: " + testCase.name
                );
                passed++;
            } else {
                console.log(
                    "FAIL: " + testCase.name
                );
                console.log(
                    "  Reason: " + error.message
                );
            }
        }
    }

    console.log("");

    console.log(
        "Model adapter evaluation: " +
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