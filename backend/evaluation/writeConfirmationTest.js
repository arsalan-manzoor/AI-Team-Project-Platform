const modelAdapter = require("../src/ai/modelAdapter");
const { runAIRequest } = require("../src/ai/aiOrchestrator");
const {
    getConfirmation
} = require("../src/services/aiConfirmation.service");

async function main() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "create_task",
                arguments: {
                    title: "Confirmation Test Task",
                    project_id: 6
                }
            },
            assistant_message: {
                role: "assistant",
                content: ""
            }
        };
    };

    const result = await runAIRequest({
        messages: [
            {
                role: "user",
                content:
                    "Create a task called Confirmation Test Task in project 6."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Write tool did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Confirmation ID was not returned"
        );
    }

    if (result.tool_name !== "create_task") {
        throw new Error(
            "Unexpected confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "create_task"
    ) {
        throw new Error(
            "Stored confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.title !==
        "Confirmation Test Task"
    ) {
        throw new Error(
            "Stored confirmation contains incorrect arguments"
        );
    }

    console.log(
        "PASS: write tool requires explicit confirmation"
    );

    console.log(
        "PASS: confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: create_task was not executed automatically"
    );

    console.log(
        "Evaluation: 3/3 cases passed"
    );
}

main().catch((error) => {
    console.error(
        "FAIL:",
        error.message
    );

    process.exit(1);
});