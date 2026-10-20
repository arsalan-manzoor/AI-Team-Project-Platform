const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const modelAdapter = require("../src/ai/modelAdapter");
const { runAIRequest } = require("../src/ai/aiOrchestrator");

async function main() {
    const responses = [
        {
            tool_calls: [
                {
                    name: "get_project",
                    arguments: {
                        project_id: 1
                    }
                },
                {
                    name: "get_project",
                    arguments: {
                        project_id: 2
                    }
                }
            ],
            assistant_message: {
                role: "assistant",
                content: ""
            }
        },
        {
            content: "AUTHORIZED_PROJECT_RESULT_PRESERVED"
        }
    ];

    let responseIndex = 0;

    modelAdapter.generateResponse = async function () {
        const response = responses[responseIndex];
        responseIndex++;
        return response;
    };

    try {
        const result = await runAIRequest({
            messages: [
                {
                    role: "user",
                    content:
                        "Check project 1 and provide information about my authorized project 2."
                }
            ],
            userId: 6
        });

        const content = String(result?.content || "");

        if (
            content.includes(
                "AUTHORIZED_PROJECT_RESULT_PRESERVED"
            )
        ) {
            console.log(
                "PASS: authorized result was preserved."
            );
        } else {
            console.log(
                "FAIL: authorized result was suppressed."
            );
            console.log("Received:", content);
            process.exitCode = 1;
        }
    } catch (error) {
        console.error("FAIL:", error.message);
        process.exitCode = 1;
    }
}

main();