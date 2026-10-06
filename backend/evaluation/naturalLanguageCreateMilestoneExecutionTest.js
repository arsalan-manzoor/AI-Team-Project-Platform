require("dotenv").config();

const assert = require("assert");
const http = require("http");
const jwt = require("jsonwebtoken");

const pool = require("../src/config/db");
const app = require("../src/app");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function startTestServer() {
    const server = http.createServer(app);

    await new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
            resolve();
        });

        server.on("error", reject);
    });

    const address = server.address();

    return {
        server,
        baseUrl:
            `http://127.0.0.1:${address.port}`
    };
}

async function stopTestServer(server) {
    await new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function main() {
    let server;
    let createdMilestoneId = null;

    try {
        const userId = 1;

        assert(
            process.env.JWT_SECRET,
            "JWT_SECRET must be configured"
        );

        const projectResult = await pool.query(
            `SELECT projects.id,
                    projects.name
             FROM projects
             JOIN team_members
                ON projects.team_id = team_members.team_id
             WHERE team_members.user_id = $1
             ORDER BY projects.id
             LIMIT 1`,
            [userId]
        );

        assert(
            projectResult.rows.length > 0,
            "No authorized project found for test user"
        );

        const project =
            projectResult.rows[0];

        const testName =
            `Natural Language Test Milestone ${Date.now()}`;

        const testDescription =
            "Created through natural-language AI confirmation test";

        const modelResponse = {
            tool_calls: [
                {
                    name: "create_milestone",
                    arguments: {
                        name: testName,
                        description:
                            testDescription,
                        project_id:
                            project.id,
                        deadline: null,
                        status: "pending"
                    }
                }
            ]
        };

        const result = await runAIRequest({
            userId,
            messages: [
                {
                    role: "user",
                    content:
                        `Create a milestone "${testName}" in the project "${project.name}" with description "${testDescription}".`
                }
            ],
            modelResponse
        });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "create_milestone should require confirmation"
        );

        assert(
            result.confirmation_id,
            "confirmation_id should be returned"
        );

        assert.strictEqual(
            result.tool_name,
            "create_milestone",
            "AI should select create_milestone"
        );

        assert.strictEqual(
            result.tool_arguments.name,
            testName,
            "Milestone name should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.description,
            testDescription,
            "Milestone description should be correct"
        );

        assert.strictEqual(
            Number(
                result.tool_arguments.project_id
            ),
            Number(project.id),
            "Project ID should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.status,
            "pending",
            "Milestone status should be pending"
        );

        const beforeConfirmation =
            await pool.query(
                `SELECT id
                 FROM milestones
                 WHERE name = $1
                   AND project_id = $2`,
                [
                    testName,
                    project.id
                ]
            );

        assert.strictEqual(
            beforeConfirmation.rows.length,
            0,
            "Milestone must not be created before confirmation"
        );

        console.log(
            "PASS: natural-language create_milestone resolved project and requires confirmation"
        );

        console.log(
            `Resolved project: ${project.name} (ID ${project.id})`
        );

        const {
            server: testServer,
            baseUrl
        } = await startTestServer();

        server = testServer;

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token = jwt.sign(
            {
                id: userId
            },
            process.env.JWT_SECRET
        );

        const response =
            await fetch(
                `${baseUrl}/api/ai/confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        confirmationId:
                            result.confirmation_id
                    })
                }
            );

        const responseBody =
            await response.json();

        assert.strictEqual(
            response.status,
            201,
            `Confirmation should return HTTP 201. Received ${response.status}: ${JSON.stringify(responseBody)}`
        );

        assert(
            responseBody.milestone,
            "Confirmation response should contain created milestone"
        );

        createdMilestoneId =
            responseBody.milestone.id;

        assert.strictEqual(
            responseBody.milestone.name,
            testName,
            "Created milestone name should match"
        );

        assert.strictEqual(
            responseBody.milestone.description,
            testDescription,
            "Created milestone description should match"
        );

        assert.strictEqual(
            Number(
                responseBody.milestone.project_id
            ),
            Number(project.id),
            "Created milestone project should match"
        );

        assert.strictEqual(
            responseBody.milestone.status,
            "pending",
            "Created milestone status should match"
        );

        const afterConfirmation =
            await pool.query(
                `SELECT id,
                        name,
                        description,
                        project_id,
                        deadline,
                        status
                 FROM milestones
                 WHERE id = $1`,
                [createdMilestoneId]
            );

        assert.strictEqual(
            afterConfirmation.rows.length,
            1,
            "Created milestone should exist in database"
        );

        const createdMilestone =
            afterConfirmation.rows[0];

        assert.strictEqual(
            createdMilestone.name,
            testName
        );

        assert.strictEqual(
            createdMilestone.description,
            testDescription
        );

        assert.strictEqual(
            Number(
                createdMilestone.project_id
            ),
            Number(project.id)
        );

        assert.strictEqual(
            createdMilestone.deadline,
            null
        );

        assert.strictEqual(
            createdMilestone.status,
            "pending"
        );

        console.log(
            `PASS: confirmation executed create_milestone successfully (milestone ID ${createdMilestoneId})`
        );

        const reuseResponse =
            await fetch(
                `${baseUrl}/api/ai/confirm`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        confirmationId:
                            result.confirmation_id
                    })
                }
            );

        const reuseBody =
            await reuseResponse.json();

        assert.strictEqual(
            reuseResponse.status,
            404,
            "Confirmation must not be reusable"
        );

        console.log(
            "PASS: confirmation cannot be reused"
        );

        const cleanupResult =
            await pool.query(
                `DELETE FROM milestones
                 WHERE id = $1
                 RETURNING id`,
                [createdMilestoneId]
            );

        assert.strictEqual(
            cleanupResult.rows.length,
            1,
            "Test milestone should be cleaned up"
        );

        createdMilestoneId = null;

        console.log(
            "PASS: test milestone cleaned up"
        );

        await stopTestServer(server);
        server = null;

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language create_milestone execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language create_milestone execution test failed:"
        );

        console.error(error);

        if (createdMilestoneId !== null) {
            try {
                await pool.query(
                    `DELETE FROM milestones
                     WHERE id = $1`,
                    [createdMilestoneId]
                );
            } catch (cleanupError) {
                console.error(
                    "Cleanup error:",
                    cleanupError
                );
            }
        }

        process.exitCode = 1;
    } finally {
        if (server) {
            try {
                await stopTestServer(server);
            } catch (error) {
                console.error(
                    "Server shutdown error:",
                    error
                );
            }
        }

        await pool.end();
    }
}

main();