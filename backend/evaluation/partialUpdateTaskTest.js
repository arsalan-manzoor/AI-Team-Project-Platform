require("dotenv").config();

const pool = require("../src/config/db");
const {
    updateTask
} = require("../src/services/task.service");

const TEST_USER_ID = 1;
const TEST_TASK_ID = 3;

async function main() {
    const originalResult = await pool.query(
        `SELECT
            id,
            title,
            description,
            assigned_to,
            status,
            priority,
            deadline
         FROM tasks
         WHERE id = $1`,
        [TEST_TASK_ID]
    );

    if (originalResult.rows.length === 0) {
        throw new Error(
            `Test task ${TEST_TASK_ID} was not found`
        );
    }

    const originalTask =
        originalResult.rows[0];

    try {
        const updatedTask =
            await updateTask({
                taskId: TEST_TASK_ID,
                title:
                    originalTask.title +
                    " - partial update",
                userId: TEST_USER_ID
            });

        if (
            updatedTask.title !==
            originalTask.title +
                " - partial update"
        ) {
            throw new Error(
                "Title was not updated correctly"
            );
        }

        console.log(
            "PASS: title was updated"
        );

        if (
            updatedTask.description !==
            originalTask.description
        ) {
            throw new Error(
                "Description was unexpectedly changed"
            );
        }

        console.log(
            "PASS: description was preserved"
        );

        if (
            Number(updatedTask.assigned_to) !==
            Number(originalTask.assigned_to)
        ) {
            throw new Error(
                "Assigned user was unexpectedly changed"
            );
        }

        console.log(
            "PASS: assigned user was preserved"
        );

        if (
            updatedTask.status !==
            originalTask.status
        ) {
            throw new Error(
                "Status was unexpectedly changed"
            );
        }

        console.log(
            "PASS: status was preserved"
        );

        if (
            updatedTask.priority !==
            originalTask.priority
        ) {
            throw new Error(
                "Priority was unexpectedly changed"
            );
        }

        console.log(
            "PASS: priority was preserved"
        );

        const restoredTask =
            await updateTask({
                taskId: TEST_TASK_ID,
                title:
                    originalTask.title,
                description:
                    originalTask.description,
                assignedTo:
                    originalTask.assigned_to,
                status:
                    originalTask.status,
                priority:
                    originalTask.priority,
                deadline:
                    originalTask.deadline,
                userId: TEST_USER_ID
            });

        if (
            restoredTask.title !==
                originalTask.title ||
            restoredTask.description !==
                originalTask.description ||
            Number(restoredTask.assigned_to) !==
                Number(originalTask.assigned_to) ||
            restoredTask.status !==
                originalTask.status ||
            restoredTask.priority !==
                originalTask.priority
        ) {
            throw new Error(
                "Original task values were not restored"
            );
        }

        console.log(
            "PASS: original task values restored"
        );
    } finally {
        await pool.query(
            `UPDATE tasks
             SET title = $1,
                 description = $2,
                 assigned_to = $3,
                 status = $4,
                 priority = $5,
                 deadline = $6
             WHERE id = $7`,
            [
                originalTask.title,
                originalTask.description,
                originalTask.assigned_to,
                originalTask.status,
                originalTask.priority,
                originalTask.deadline,
                TEST_TASK_ID
            ]
        );

        await pool.end();
    }
}

main().catch((error) => {
    console.error(
        "FAIL:",
        error.message
    );

    process.exit(1);
});