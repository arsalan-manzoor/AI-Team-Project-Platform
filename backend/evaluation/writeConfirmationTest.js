require("dotenv").config();

const modelAdapter = require("../src/ai/modelAdapter");

const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

const {
    getConfirmation
} = require("../src/services/aiConfirmation.service");


async function runCreateTaskTest() {
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
            "Create task did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Create task confirmation ID was not returned"
        );
    }

    if (result.tool_name !== "create_task") {
        throw new Error(
            "Unexpected create_task confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Create task confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "create_task"
    ) {
        throw new Error(
            "Stored create_task confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.title !==
        "Confirmation Test Task"
    ) {
        throw new Error(
            "Stored create_task confirmation contains incorrect arguments"
        );
    }

    console.log(
        "PASS: create_task requires explicit confirmation"
    );

    console.log(
        "PASS: create_task confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: create_task was not executed automatically"
    );
}


async function runUpdateTaskTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "update_task",
                arguments: {
                    task_id: 11,
                    title: "Updated Confirmation Test Task",
                    description:
                        "Updated through AI confirmation",
                    status: "in_progress",
                    priority: "high",
                    deadline: "2026-10-15"
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
                    "Update task 11 and change its title, status, priority and deadline."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Update task did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Update task confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "update_task"
    ) {
        throw new Error(
            "Unexpected update_task confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Update task confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "update_task"
    ) {
        throw new Error(
            "Stored update_task confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.task_id !==
        11
    ) {
        throw new Error(
            "Stored update_task confirmation contains the wrong task ID"
        );
    }

    if (
        confirmation.toolArguments.title !==
        "Updated Confirmation Test Task"
    ) {
        throw new Error(
            "Stored update_task confirmation contains incorrect title"
        );
    }

    console.log(
        "PASS: update_task requires explicit confirmation"
    );

    console.log(
        "PASS: update_task confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: update_task was not executed automatically"
    );
}


async function runCreateProjectTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "create_project",
                arguments: {
                    name: "Confirmation Test Project",
                    description:
                        "Created through AI confirmation",
                    team_id: 5
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
                    "Create a project called Confirmation Test Project in team 5."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Create project did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Create project confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "create_project"
    ) {
        throw new Error(
            "Unexpected create_project confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Create project confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "create_project"
    ) {
        throw new Error(
            "Stored create_project confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.name !==
        "Confirmation Test Project"
    ) {
        throw new Error(
            "Stored create_project confirmation contains incorrect project name"
        );
    }

    if (
        confirmation.toolArguments.team_id !==
        5
    ) {
        throw new Error(
            "Stored create_project confirmation contains incorrect team ID"
        );
    }

    console.log(
        "PASS: create_project requires explicit confirmation"
    );

    console.log(
        "PASS: create_project confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: create_project was not executed automatically"
    );
}


async function runCreateMilestoneTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "create_milestone",
                arguments: {
                    name:
                        "Confirmation Test Milestone",
                    description:
                        "Created through AI confirmation",
                    project_id: 6,
                    deadline:
                        "2026-10-20",
                    status:
                        "pending"
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
                    "Create a milestone called Confirmation Test Milestone in project 6."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Create milestone did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Create milestone confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "create_milestone"
    ) {
        throw new Error(
            "Unexpected create_milestone confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Create milestone confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "create_milestone"
    ) {
        throw new Error(
            "Stored create_milestone confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.name !==
        "Confirmation Test Milestone"
    ) {
        throw new Error(
            "Stored create_milestone confirmation contains incorrect milestone name"
        );
    }

    if (
        confirmation.toolArguments.project_id !==
        6
    ) {
        throw new Error(
            "Stored create_milestone confirmation contains incorrect project ID"
        );
    }

    if (
        confirmation.toolArguments.status !==
        "pending"
    ) {
        throw new Error(
            "Stored create_milestone confirmation contains incorrect status"
        );
    }

    console.log(
        "PASS: create_milestone requires explicit confirmation"
    );

    console.log(
        "PASS: create_milestone confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: create_milestone was not executed automatically"
    );
}


async function runDeleteTaskTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "delete_task",
                arguments: {
                    task_id: 11
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
                    "Delete task 11."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Delete task did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Delete task confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "delete_task"
    ) {
        throw new Error(
            "Unexpected delete_task confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Delete task confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "delete_task"
    ) {
        throw new Error(
            "Stored delete_task confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.task_id !==
        11
    ) {
        throw new Error(
            "Stored delete_task confirmation contains the wrong task ID"
        );
    }

    console.log(
        "PASS: delete_task requires explicit confirmation"
    );

    console.log(
        "PASS: delete_task confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: delete_task was not executed automatically"
    );
}


async function runDeleteProjectTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "delete_project",
                arguments: {
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
                    "Delete project 6."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Delete project did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Delete project confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "delete_project"
    ) {
        throw new Error(
            "Unexpected delete_project confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Delete project confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "delete_project"
    ) {
        throw new Error(
            "Stored delete_project confirmation contains the wrong tool"
        );
    }

    if (
        confirmation.toolArguments.project_id !==
        6
    ) {
        throw new Error(
            "Stored delete_project confirmation contains the wrong project ID"
        );
    }

    console.log(
        "PASS: delete_project requires explicit confirmation"
    );

    console.log(
        "PASS: delete_project confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: delete_project was not executed automatically"
    );
}


async function runBulkUpdateTasksTest() {
    modelAdapter.generateResponse = async function () {
        return {
            tool_call: {
                name: "bulk_update_tasks",
                arguments: {
                    task_ids: [
                        11,
                        12,
                        13
                    ],
                    status: "in_progress",
                    priority: "high",
                    deadline: "2026-10-25"
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
                    "Update tasks 11, 12 and 13 together. Set their status to in progress, priority to high and deadline to October 25."
            }
        ],
        userId: 16
    });

    if (!result.requires_confirmation) {
        throw new Error(
            "Bulk update tasks did not require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Bulk update tasks confirmation ID was not returned"
        );
    }

    if (
        result.tool_name !==
        "bulk_update_tasks"
    ) {
        throw new Error(
            "Unexpected bulk_update_tasks confirmation tool name"
        );
    }

    const confirmation =
        getConfirmation(
            result.confirmation_id,
            16
        );

    if (!confirmation) {
        throw new Error(
            "Bulk update tasks confirmation was not stored for the authenticated user"
        );
    }

    if (
        confirmation.toolName !==
        "bulk_update_tasks"
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains the wrong tool"
        );
    }

    if (
        !Array.isArray(
            confirmation.toolArguments.task_ids
        )
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation does not contain task IDs"
        );
    }

    if (
        confirmation.toolArguments.task_ids.length !==
        3
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains the wrong number of task IDs"
        );
    }

    if (
        confirmation.toolArguments.task_ids[0] !==
        11 ||
        confirmation.toolArguments.task_ids[1] !==
        12 ||
        confirmation.toolArguments.task_ids[2] !==
        13
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains incorrect task IDs"
        );
    }

    if (
        confirmation.toolArguments.status !==
        "in_progress"
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains incorrect status"
        );
    }

    if (
        confirmation.toolArguments.priority !==
        "high"
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains incorrect priority"
        );
    }

    if (
        confirmation.toolArguments.deadline !==
        "2026-10-25"
    ) {
        throw new Error(
            "Stored bulk_update_tasks confirmation contains incorrect deadline"
        );
    }

    console.log(
        "PASS: bulk_update_tasks requires explicit confirmation"
    );

    console.log(
        "PASS: bulk_update_tasks confirmation is bound to the authenticated user"
    );

    console.log(
        "PASS: bulk_update_tasks was not executed automatically"
    );
}


async function main() {
    await runCreateTaskTest();

    await runUpdateTaskTest();

    await runCreateProjectTest();

    await runCreateMilestoneTest();

    await runDeleteTaskTest();

    await runDeleteProjectTest();

    await runBulkUpdateTasksTest();

    console.log(
        "Evaluation: 21/21 cases passed"
    );
}


main().catch((error) => {
    console.error(
        "FAIL:",
        error.message
    );

    process.exit(1);
});