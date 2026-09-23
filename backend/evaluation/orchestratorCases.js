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
model_response: {
tool_call: {
name: "get_project",
arguments: {
project_id: 2
}
}
},
expected_data: true
},

{
    name: "unauthorized_project_access",
    user_id: 6,
    model_response: {
        tool_call: {
            name: "get_project",
            arguments: {
                project_id: 1
            }
        }
    },
    expected_data: false
},

{
    name: "authorized_project_list",
    user_id: 6,
    model_response: {
        tool_call: {
            name: "get_projects",
            arguments: {}
        }
    },
    expected_data: true
},

{
    name: "missing_required_project_id",
    user_id: 6,
    model_response: {
        tool_call: {
            name: "get_project",
            arguments: {}
        }
    },
    expected_error:
        "Missing required AI tool argument: project_id"
},

{
    name: "invalid_project_id_type",
    user_id: 6,
    model_response: {
        tool_call: {
            name: "get_project",
            arguments: {
                project_id: "abc"
            }
        }
    },
    expected_error:
        'AI tool argument "project_id" must be a valid integer'
},

{
    name: "invalid_user_id",
    user_id: null,
    model_response: {
        tool_call: {
            name: "get_projects",
            arguments: {}
        }
    },
    expected_error:
        "Authenticated user ID must be a valid integer"
},

{
    name: "unknown_tool",
    user_id: 6,
    model_response: {
        tool_call: {
            name: "delete_everything",
            arguments: {}
        }
    },
    expected_error: "Unknown AI tool"
},

{
    name: "normal_response",
    user_id: 6,
    model_response: {
        content: "Normal AI response"
    },
    expected_content: "Normal AI response"
},

{
    name: "invalid_tool_call_structure",
    user_id: 6,
    model_response: {
        tool_call: {
            arguments: {
                project_id: 2
            }
        }
    },
    expected_error: "Unknown AI tool"
}

];

async function runCase(testCase) {
modelAdapter.generateResponse = async function () {
return testCase.model_response;
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

    let hasData;

    if (
        result.tool_result &&
        typeof result.tool_result === "object" &&
        Object.prototype.hasOwnProperty.call(
            result.tool_result,
            "data"
        )
    ) {
        hasData = result.tool_result.data !== null;
    } else {
        hasData = result.tool_result !== null;
    }

    const passed =
        hasData === testCase.expected_data;

    console.log(
        (passed ? "PASS" : "FAIL") +
        ": " +
        testCase.name
    );

    return passed;
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
