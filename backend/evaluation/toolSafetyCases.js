const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const { executeTool } = require("../src/ai/toolExecutor");
const tools = require("../src/ai/toolRegistry");

async function runSafetyCase() {
    const originalType = tools.get_project.type;

    try {
        tools.get_project.type = "write";

        await executeTool(
            "get_project",
            { project_id: 2 },
            6
        );

        return {
            passed: false,
            reason: "Non-read tool was executed"
        };
    } catch (error) {
        return {
            passed:
                error.message ===
                'AI tool "get_project" is not permitted for execution',
            reason: error.message
        };
    } finally {
        tools.get_project.type = originalType;
    }
}

async function runEvaluation() {
    const result = await runSafetyCase();

    if (result.passed) {
        console.log("PASS: non-read tool rejection");
        console.log("Evaluation: 1/1 cases passed");
    } else {
        console.log("FAIL: non-read tool rejection");
        console.log(`  Reason: ${result.reason}`);
        console.log("Evaluation: 0/1 cases passed");
        process.exitCode = 1;
    }
}

runEvaluation();