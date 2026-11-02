const {
    validateToolCall,
    normalizeToolArguments
} = require("../src/ai/modelAdapter");

const tools = [
    {
        name: "get_project",
        parameters: {
            project_id: {
                type: "integer"
            }
        }
    },
    {
        name: "get_task",
        parameters: {
            task_id: {
                type: "integer"
            }
        }
    }
];

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
        expected_error: "Ollama returned an invalid tool call"
    },
    {
        name: "missing_tool_name",
        tool_call: {
            arguments: {
                project_id: 6
            }
        },
        expected_error: "Ollama returned an invalid tool name"
    },
    {
        name: "invalid_tool_name",
        tool_call: {
            name: "",
            arguments: {}
        },
        expected_error: "Ollama returned an invalid tool name"
    },
    {
        name: "missing_tool_arguments",
        tool_call: {
            name: "get_project"
        },
        expected_error: "Ollama returned invalid tool arguments"
    },
    {
        name: "invalid_tool_arguments",
        tool_call: {
            name: "get_project",
            arguments: []
        },
        expected_error: "Ollama returned invalid tool arguments"
    },
    {
        name: "null_tool_arguments",
        tool_call: {
            name: "get_project",
            arguments: null
        },
        expected_error: "Ollama returned invalid tool arguments"
    },
    {
        name: "integer_argument",
        tool_call: {
            name: "get_project",
            arguments: {
                project_id: 6
            }
        },
        expected_error: null
    },
    {
        name: "string_integer_rejected_without_normalization",
        tool_call: {
            name: "get_task",
            arguments: {
                task_id: "180"
            }
        },
        expected_error:
            "Ollama returned an invalid integer argument: task_id"
    },
    {
        name: "decimal_argument_rejected",
        tool_call: {
            name: "get_task",
            arguments: {
                task_id: 1.5
            }
        },
        expected_error:
            "Ollama returned an invalid integer argument: task_id"
    }
];

function runValidationEvaluation() {
    let passed = 0;

    for (const testCase of cases) {
        try {
            validateToolCall(
                testCase.tool_call,
                tools
            );

            if (testCase.expected_error === null) {
                console.log("PASS: " + testCase.name);
                passed++;
            } else {
                console.log("FAIL: " + testCase.name);
                console.log("  Reason: expected validation error");
            }
        } catch (error) {
            if (error.message === testCase.expected_error) {
                console.log("PASS: " + testCase.name);
                passed++;
            } else {
                console.log("FAIL: " + testCase.name);
                console.log("  Reason: " + error.message);
            }
        }
    }

    console.log("");

    console.log(
        "Model adapter validation: " +
        passed +
        "/" +
        cases.length +
        " cases passed"
    );

    if (passed !== cases.length) {
        process.exitCode = 1;
    }
}

function runNormalizationEvaluation() {
    const normalizationCases = [
        {
            name: "numeric_string_converted_to_integer",
            arguments: {
                task_id: "180"
            },
            expected: {
                task_id: 180
            }
        },
        {
            name: "integer_remains_integer",
            arguments: {
                task_id: 180
            },
            expected: {
                task_id: 180
            }
        },
        {
            name: "decimal_string_not_converted",
            arguments: {
                task_id: "1.5"
            },
            expected: {
                task_id: "1.5"
            }
        },
        {
            name: "unsafe_integer_string_not_converted",
            arguments: {
                task_id: "9007199254740992"
            },
            expected: {
                task_id: "9007199254740992"
            }
        }
    ];

    let passed = 0;

    for (const testCase of normalizationCases) {
        try {
            const actual = normalizeToolArguments(
                testCase.arguments,
                tools.find((tool) => tool.name === "get_task")
            );

            if (
                JSON.stringify(actual) ===
                JSON.stringify(testCase.expected)
            ) {
                console.log("PASS: " + testCase.name);
                passed++;
            } else {
                console.log("FAIL: " + testCase.name);
                console.log("  Expected:", testCase.expected);
                console.log("  Actual:", actual);
            }
        } catch (error) {
            console.log("FAIL: " + testCase.name);
            console.log("  Reason: " + error.message);
        }
    }

    console.log("");

    console.log(
        "Model adapter normalization: " +
        passed +
        "/" +
        normalizationCases.length +
        " cases passed"
    );

    if (passed !== normalizationCases.length) {
        process.exitCode = 1;
    }
}

runValidationEvaluation();
runNormalizationEvaluation();
