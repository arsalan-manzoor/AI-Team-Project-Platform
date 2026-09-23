const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const { executeTool } = require("../src/ai/toolExecutor");
const readOnlyToolCases = require("./readOnlyToolCases");

async function runCase(testCase) {
    try {
        const result = await executeTool(
            testCase.tool,
            testCase.arguments,
            testCase.user_id
        );

        if (!testCase.expected.should_execute) {
            return {
                name: testCase.name,
                passed: false,
                reason: "Tool executed when it should have been rejected"
            };
        }

        let shouldReturnData;

        if (
            result &&
            typeof result === "object" &&
            Object.prototype.hasOwnProperty.call(result, "data")
        ) {
            shouldReturnData = result.data !== null;
        } else {
            shouldReturnData = result !== null;
        }

        return {
            name: testCase.name,
            passed:
                shouldReturnData ===
                testCase.expected.should_return_data
        };
    } catch (error) {
        if (testCase.expected.should_execute) {
            return {
                name: testCase.name,
                passed: false,
                reason: error.message
            };
        }

        return {
            name: testCase.name,
            passed:
                error.message === testCase.expected.error
        };
    }
}

async function runEvaluation() {
    let passed = 0;

    for (const testCase of readOnlyToolCases) {
        const result = await runCase(testCase);

        if (result.passed) {
            passed++;
            console.log(`PASS: ${result.name}`);
        } else {
            console.log(`FAIL: ${result.name}`);

            if (result.reason) {
                console.log(`  Reason: ${result.reason}`);
            }
        }
    }

    console.log("");
    console.log(
        `Evaluation: ${passed}/${readOnlyToolCases.length} cases passed`
    );

    if (passed !== readOnlyToolCases.length) {
        process.exitCode = 1;
    }
}

runEvaluation();