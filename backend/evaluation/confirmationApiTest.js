const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const pool = require("../src/config/db");

const {
    createConfirmation
} = require("../src/services/aiConfirmation.service");

async function sendRequest({
    token,
    confirmationId,
    port
}) {
    const body = JSON.stringify({
        confirmationId
    });

    return new Promise((resolve, reject) => {
        const request = http.request(
            {
                hostname: "localhost",
                port,
                path: "/api/ai/confirm",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        "Bearer " + token,
                    "Content-Length":
                        Buffer.byteLength(body)
                }
            },
            (response) => {
                let data = "";

                response.on("data", (chunk) => {
                    data += chunk;
                });

                response.on("end", () => {
                    let parsed;

                    try {
                        parsed = JSON.parse(data);
                    } catch {
                        parsed = {
                            raw: data
                        };
                    }

                    resolve({
                        status:
                            response.statusCode,
                        body: parsed
                    });
                });
            }
        );

        request.on("error", reject);

        request.write(body);
        request.end();
    });
}

async function runTest() {
    let taskId = null;
    let projectId = null;
    let milestoneId = null;
    let bulkTaskIds = [];
    let server = null;

    try {
        const userId = 16;

        const token = jwt.sign(
            {
                id: userId,
                email:
                    "zyraaitest2026@gmail.com"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        server = app.listen(5001, () => {
            console.log(
                "Test API server started on port 5001"
            );
        });

        await new Promise((resolve) =>
            server.once("listening", resolve)
        );

        /*
         * CREATE TASK CONFIRMATION
         */

        const testTitle =
            "AI Confirmation API Test " +
            Date.now();

        console.log(
            "Creating test confirmation..."
        );

        const createConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "create_task",
                toolArguments: {
                    title: testTitle,
                    description:
                        "Created by confirmation API evaluation",
                    project_id: 6
                }
            });

        console.log(
            "PASS: Test create_task confirmation created"
        );

        console.log("");

        console.log(
            "Sending create_task confirmation request..."
        );

        const createResponse =
            await sendRequest({
                token,
                confirmationId:
                    createConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            createResponse.status
        );

        console.log(
            "Response:",
            createResponse.body
        );

        if (createResponse.status !== 201) {
            throw new Error(
                "Create task confirmation API request failed"
            );
        }

        if (
            !createResponse.body ||
            !createResponse.body.task
        ) {
            throw new Error(
                "Create task confirmation API did not return the created task"
            );
        }

        taskId =
            createResponse.body.task.id;

        if (
            createResponse.body.task.title !==
            testTitle
        ) {
            throw new Error(
                "Created task has the wrong title"
            );
        }

        console.log(
            "PASS: Confirmed AI action created the task"
        );

        console.log("");

        console.log(
            "Testing create_task confirmation single-use behavior..."
        );

        const secondCreateResponse =
            await sendRequest({
                token,
                confirmationId:
                    createConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second HTTP status:",
            secondCreateResponse.status
        );

        console.log(
            "Second response:",
            secondCreateResponse.body
        );

        if (
            secondCreateResponse.status !== 404
        ) {
            throw new Error(
                "Create task confirmation was reusable"
            );
        }

        console.log(
            "PASS: create_task confirmation cannot be reused"
        );

        /*
         * UPDATE TASK CONFIRMATION
         */

        const updatedTitle =
            "Updated AI Task " +
            Date.now();

        console.log("");

        console.log(
            "Creating update_task confirmation..."
        );

        const updateConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "update_task",
                toolArguments: {
                    task_id: taskId,
                    title: updatedTitle,
                    description:
                        "Updated by confirmation API evaluation",
                    assigned_to: null,
                    status: "in_progress",
                    priority: "high",
                    deadline: "2026-10-15"
                }
            });

        console.log(
            "PASS: Test update_task confirmation created"
        );

        console.log("");

        console.log(
            "Sending update_task confirmation request..."
        );

        const updateResponse =
            await sendRequest({
                token,
                confirmationId:
                    updateConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            updateResponse.status
        );

        console.log(
            "Response:",
            updateResponse.body
        );

        if (updateResponse.status !== 200) {
            throw new Error(
                "Update task confirmation API request failed"
            );
        }

        if (
            !updateResponse.body ||
            !updateResponse.body.task
        ) {
            throw new Error(
                "Update task confirmation API did not return the updated task"
            );
        }

        if (
            updateResponse.body.task.id !==
            taskId
        ) {
            throw new Error(
                "Updated task has the wrong task ID"
            );
        }

        if (
            updateResponse.body.task.title !==
            updatedTitle
        ) {
            throw new Error(
                "Updated task has the wrong title"
            );
        }

        if (
            updateResponse.body.task.status !==
            "in_progress"
        ) {
            throw new Error(
                "Updated task has the wrong status"
            );
        }

        if (
            updateResponse.body.task.priority !==
            "high"
        ) {
            throw new Error(
                "Updated task has the wrong priority"
            );
        }

        console.log(
            "PASS: Confirmed AI action updated the task"
        );

        console.log("");

        console.log(
            "Testing update_task confirmation single-use behavior..."
        );

        const secondUpdateResponse =
            await sendRequest({
                token,
                confirmationId:
                    updateConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second update HTTP status:",
            secondUpdateResponse.status
        );

        console.log(
            "Second update response:",
            secondUpdateResponse.body
        );

        if (
            secondUpdateResponse.status !== 404
        ) {
            throw new Error(
                "Update task confirmation was reusable"
            );
        }

        console.log(
            "PASS: update_task confirmation cannot be reused"
        );

        /*
         * DELETE TASK CONFIRMATION
         */

        console.log("");

        console.log(
            "Creating delete_task confirmation..."
        );

        const deleteConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "delete_task",
                toolArguments: {
                    task_id: taskId
                }
            });

        console.log(
            "PASS: Test delete_task confirmation created"
        );

        console.log("");

        console.log(
            "Sending delete_task confirmation request..."
        );

        const deleteResponse =
            await sendRequest({
                token,
                confirmationId:
                    deleteConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            deleteResponse.status
        );

        console.log(
            "Response:",
            deleteResponse.body
        );

        if (deleteResponse.status !== 200) {
            throw new Error(
                "Delete task confirmation API request failed"
            );
        }

        if (
            !deleteResponse.body ||
            !deleteResponse.body.task
        ) {
            throw new Error(
                "Delete task confirmation API did not return the deleted task"
            );
        }

        if (
            deleteResponse.body.task.id !==
            taskId
        ) {
            throw new Error(
                "Deleted task has the wrong task ID"
            );
        }

        console.log(
            "PASS: Confirmed AI action deleted the task"
        );

        taskId = null;

        console.log("");

        console.log(
            "Testing delete_task confirmation single-use behavior..."
        );

        const secondDeleteResponse =
            await sendRequest({
                token,
                confirmationId:
                    deleteConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second delete HTTP status:",
            secondDeleteResponse.status
        );

        console.log(
            "Second delete response:",
            secondDeleteResponse.body
        );

        if (
            secondDeleteResponse.status !== 404
        ) {
            throw new Error(
                "Delete task confirmation was reusable"
            );
        }

        console.log(
            "PASS: delete_task confirmation cannot be reused"
        );

        /*
         * CREATE PROJECT CONFIRMATION
         */

        const projectName =
            "AI Confirmation Project " +
            Date.now();

        console.log("");

        console.log(
            "Creating create_project confirmation..."
        );

        const projectConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "create_project",
                toolArguments: {
                    name: projectName,
                    description:
                        "Created by confirmation API evaluation",
                    team_id: 5
                }
            });

        console.log(
            "PASS: Test create_project confirmation created"
        );

        console.log("");

        console.log(
            "Sending create_project confirmation request..."
        );

        const projectResponse =
            await sendRequest({
                token,
                confirmationId:
                    projectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            projectResponse.status
        );

        console.log(
            "Response:",
            projectResponse.body
        );

        if (projectResponse.status !== 201) {
            throw new Error(
                "Create project confirmation API request failed"
            );
        }

        if (
            !projectResponse.body ||
            !projectResponse.body.project
        ) {
            throw new Error(
                "Create project confirmation API did not return the created project"
            );
        }

        projectId =
            projectResponse.body.project.id;

        if (
            projectResponse.body.project.name !==
            projectName
        ) {
            throw new Error(
                "Created project has the wrong name"
            );
        }

        if (
            projectResponse.body.project.team_id !==
            5
        ) {
            throw new Error(
                "Created project has the wrong team ID"
            );
        }

        console.log(
            "PASS: Confirmed AI action created the project"
        );

        console.log("");

        console.log(
            "Testing create_project confirmation single-use behavior..."
        );

        const secondProjectResponse =
            await sendRequest({
                token,
                confirmationId:
                    projectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second project HTTP status:",
            secondProjectResponse.status
        );

        console.log(
            "Second project response:",
            secondProjectResponse.body
        );

        if (
            secondProjectResponse.status !== 404
        ) {
            throw new Error(
                "Create project confirmation was reusable"
            );
        }

        console.log(
            "PASS: create_project confirmation cannot be reused"
        );

        /*
         * UPDATE PROJECT CONFIRMATION
         */

        const updatedProjectName =
            "Updated AI Confirmation Project " +
            Date.now();

        const updatedProjectDescription =
            "Updated by update_project confirmation API evaluation";

        console.log("");

        console.log(
            "Creating update_project confirmation..."
        );

        const updateProjectConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "update_project",
                toolArguments: {
                    project_id: projectId,
                    name: updatedProjectName,
                    description:
                        updatedProjectDescription
                }
            });

        console.log(
            "PASS: Test update_project confirmation created"
        );

        console.log("");

        console.log(
            "Sending update_project confirmation request..."
        );

        const updateProjectResponse =
            await sendRequest({
                token,
                confirmationId:
                    updateProjectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            updateProjectResponse.status
        );

        console.log(
            "Response:",
            updateProjectResponse.body
        );

        if (
            updateProjectResponse.status !== 200
        ) {
            throw new Error(
                "Update project confirmation API request failed"
            );
        }

        if (
            !updateProjectResponse.body ||
            !updateProjectResponse.body.project
        ) {
            throw new Error(
                "Update project confirmation API did not return the updated project"
            );
        }

        if (
            updateProjectResponse.body.project.id !==
            projectId
        ) {
            throw new Error(
                "Updated project has the wrong project ID"
            );
        }

        if (
            updateProjectResponse.body.project.name !==
            updatedProjectName
        ) {
            throw new Error(
                "Updated project has the wrong name"
            );
        }

        if (
            updateProjectResponse.body.project.description !==
            updatedProjectDescription
        ) {
            throw new Error(
                "Updated project has the wrong description"
            );
        }

        console.log(
            "PASS: Confirmed AI action updated the project"
        );

        console.log("");

        console.log(
            "Testing update_project confirmation single-use behavior..."
        );

        const secondUpdateProjectResponse =
            await sendRequest({
                token,
                confirmationId:
                    updateProjectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second update project HTTP status:",
            secondUpdateProjectResponse.status
        );

        console.log(
            "Second update project response:",
            secondUpdateProjectResponse.body
        );

        if (
            secondUpdateProjectResponse.status !== 404
        ) {
            throw new Error(
                "Update project confirmation was reusable"
            );
        }

        console.log(
            "PASS: update_project confirmation cannot be reused"
        );

        /*
         * DELETE PROJECT CONFIRMATION
         */

        console.log("");

        console.log(
            "Creating delete_project confirmation..."
        );

        const deleteProjectConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "delete_project",
                toolArguments: {
                    project_id: projectId
                }
            });

        console.log(
            "PASS: Test delete_project confirmation created"
        );

        console.log("");

        console.log(
            "Sending delete_project confirmation request..."
        );

        const deleteProjectResponse =
            await sendRequest({
                token,
                confirmationId:
                    deleteProjectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            deleteProjectResponse.status
        );

        console.log(
            "Response:",
            deleteProjectResponse.body
        );

        if (
            deleteProjectResponse.status !== 200
        ) {
            throw new Error(
                "Delete project confirmation API request failed"
            );
        }

        if (
            !deleteProjectResponse.body ||
            !deleteProjectResponse.body.project
        ) {
            throw new Error(
                "Delete project confirmation API did not return the deleted project"
            );
        }

        if (
            deleteProjectResponse.body.project.id !==
            projectId
        ) {
            throw new Error(
                "Deleted project has the wrong project ID"
            );
        }

        console.log(
            "PASS: Confirmed AI action deleted the project"
        );

        projectId = null;

        console.log("");

        console.log(
            "Testing delete_project confirmation single-use behavior..."
        );

        const secondDeleteProjectResponse =
            await sendRequest({
                token,
                confirmationId:
                    deleteProjectConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second delete project HTTP status:",
            secondDeleteProjectResponse.status
        );

        console.log(
            "Second delete project response:",
            secondDeleteProjectResponse.body
        );

        if (
            secondDeleteProjectResponse.status !== 404
        ) {
            throw new Error(
                "Delete project confirmation was reusable"
            );
        }

        console.log(
            "PASS: delete_project confirmation cannot be reused"
        );

        /*
         * CREATE MILESTONE CONFIRMATION
         */

        const milestoneName =
            "AI Confirmation Milestone " +
            Date.now();

        console.log("");

        console.log(
            "Creating create_milestone confirmation..."
        );

        const milestoneConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "create_milestone",
                toolArguments: {
                    name: milestoneName,
                    description:
                        "Created by confirmation API evaluation",
                    project_id: 6,
                    deadline: "2026-10-20",
                    status: "pending"
                }
            });

        console.log(
            "PASS: Test create_milestone confirmation created"
        );

        console.log("");

        console.log(
            "Sending create_milestone confirmation request..."
        );

        const milestoneResponse =
            await sendRequest({
                token,
                confirmationId:
                    milestoneConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            milestoneResponse.status
        );

        console.log(
            "Response:",
            milestoneResponse.body
        );

        if (
            milestoneResponse.status !== 201
        ) {
            throw new Error(
                "Create milestone confirmation API request failed"
            );
        }

        if (
            !milestoneResponse.body ||
            !milestoneResponse.body.milestone
        ) {
            throw new Error(
                "Create milestone confirmation API did not return the created milestone"
            );
        }

        milestoneId =
            milestoneResponse.body.milestone.id;

        if (
            milestoneResponse.body.milestone.name !==
            milestoneName
        ) {
            throw new Error(
                "Created milestone has the wrong name"
            );
        }

        if (
            milestoneResponse.body.milestone.project_id !==
            6
        ) {
            throw new Error(
                "Created milestone has the wrong project ID"
            );
        }

        if (
            milestoneResponse.body.milestone.status !==
            "pending"
        ) {
            throw new Error(
                "Created milestone has the wrong status"
            );
        }

        console.log(
            "PASS: Confirmed AI action created the milestone"
        );

        console.log("");

        console.log(
            "Testing create_milestone confirmation single-use behavior..."
        );

        const secondMilestoneResponse =
            await sendRequest({
                token,
                confirmationId:
                    milestoneConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second milestone HTTP status:",
            secondMilestoneResponse.status
        );

        console.log(
            "Second milestone response:",
            secondMilestoneResponse.body
        );

        if (
            secondMilestoneResponse.status !== 404
        ) {
            throw new Error(
                "Create milestone confirmation was reusable"
            );
        }

        console.log(
            "PASS: create_milestone confirmation cannot be reused"
        );

        /*
         * BULK UPDATE TASKS CONFIRMATION
         */

        console.log("");

        console.log(
            "Creating temporary tasks for bulk_update_tasks..."
        );

        const bulkTaskResult =
            await pool.query(
                `
                INSERT INTO tasks
                (
                    title,
                    description,
                    project_id,
                    created_by,
                    status,
                    priority
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                ),
                (
                    $7,
                    $8,
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING id
                `,
                [
                    "Bulk Confirmation Test Task 1",
                    "Created for bulk confirmation API evaluation",
                    6,
                    userId,
                    "pending",
                    "medium",
                    "Bulk Confirmation Test Task 2",
                    "Created for bulk confirmation API evaluation"
                ]
            );

        bulkTaskIds =
            bulkTaskResult.rows.map(
                (row) => row.id
            );

        if (
            bulkTaskIds.length !== 2
        ) {
            throw new Error(
                "Could not create temporary tasks for bulk update test"
            );
        }

        console.log(
            "PASS: Temporary bulk-update tasks created",
            bulkTaskIds
        );

        console.log("");

        console.log(
            "Creating bulk_update_tasks confirmation..."
        );

        const bulkConfirmationRequest =
            createConfirmation({
                userId,
                conversationId: null,
                toolName: "bulk_update_tasks",
                toolArguments: {
                    task_ids:
                        bulkTaskIds,
                    status:
                        "in_progress",
                    priority:
                        "high",
                    deadline:
                        "2026-10-25"
                }
            });

        console.log(
            "PASS: Test bulk_update_tasks confirmation created"
        );

        console.log("");

        console.log(
            "Sending bulk_update_tasks confirmation request..."
        );

        const bulkResponse =
            await sendRequest({
                token,
                confirmationId:
                    bulkConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "HTTP status:",
            bulkResponse.status
        );

        console.log(
            "Response:",
            bulkResponse.body
        );

        if (
            bulkResponse.status !== 200
        ) {
            throw new Error(
                "Bulk update tasks confirmation API request failed"
            );
        }

        if (
            !bulkResponse.body ||
            !Array.isArray(
                bulkResponse.body.tasks
            )
        ) {
            throw new Error(
                "Bulk update tasks confirmation API did not return updated tasks"
            );
        }

        if (
            bulkResponse.body.tasks.length !==
            bulkTaskIds.length
        ) {
            throw new Error(
                "Bulk update tasks API returned the wrong number of tasks"
            );
        }

        for (
            const task
            of bulkResponse.body.tasks
        ) {
            if (
                !bulkTaskIds.includes(
                    task.id
                )
            ) {
                throw new Error(
                    "Bulk update returned an unexpected task ID"
                );
            }

            if (
                task.status !==
                "in_progress"
            ) {
                throw new Error(
                    "Bulk updated task has the wrong status"
                );
            }

            if (
                task.priority !==
                "high"
            ) {
                throw new Error(
                    "Bulk updated task has the wrong priority"
                );
            }
        }

        console.log(
            "PASS: Confirmed AI action updated multiple tasks"
        );

        console.log("");

        console.log(
            "Testing bulk_update_tasks confirmation single-use behavior..."
        );

        const secondBulkResponse =
            await sendRequest({
                token,
                confirmationId:
                    bulkConfirmationRequest.confirmationId,
                port: 5001
            });

        console.log(
            "Second bulk update HTTP status:",
            secondBulkResponse.status
        );

        console.log(
            "Second bulk update response:",
            secondBulkResponse.body
        );

        if (
            secondBulkResponse.status !== 404
        ) {
            throw new Error(
                "Bulk update tasks confirmation was reusable"
            );
        }

        console.log(
            "PASS: bulk_update_tasks confirmation cannot be reused"
        );

        console.log("");

        console.log(
            "Confirmation API evaluation passed."
        );
    } catch (error) {
        console.error("");

        console.error(
            "Confirmation API test failed:"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;
    } finally {
        if (milestoneId) {
            await pool.query(
                `
                DELETE FROM milestones
                WHERE id = $1
                `,
                [milestoneId]
            );

            console.log(
                "Test milestone cleaned up."
            );
        }

        if (taskId) {
            await pool.query(
                `
                DELETE FROM tasks
                WHERE id = $1
                `,
                [taskId]
            );

            console.log(
                "Test task cleaned up."
            );
        }

        if (
            bulkTaskIds.length > 0
        ) {
            await pool.query(
                `
                DELETE FROM tasks
                WHERE id = ANY($1::int[])
                `,
                [bulkTaskIds]
            );

            console.log(
                "Bulk-update test tasks cleaned up."
            );
        }

        if (projectId) {
            await pool.query(
                `
                DELETE FROM projects
                WHERE id = $1
                `,
                [projectId]
            );

            console.log(
                "Test project cleaned up."
            );
        }

        if (server) {
            await new Promise(
                (resolve) =>
                    server.close(resolve)
            );

            console.log(
                "Test API server stopped."
            );
        }

        await pool.end();
    }
}

runTest();