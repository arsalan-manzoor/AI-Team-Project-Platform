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
    let createdProjectId = null;

    try {
        const userId = 1;

        assert(
            process.env.JWT_SECRET,
            "JWT_SECRET must be configured"
        );

        const teamResult = await pool.query(
            `SELECT teams.id,
                    teams.name
             FROM teams
             JOIN team_members
                ON teams.id = team_members.team_id
             WHERE team_members.user_id = $1
             ORDER BY teams.id
             LIMIT 1`,
            [userId]
        );

        assert(
            teamResult.rows.length > 0,
            "No authorized team found for test user"
        );

        const team =
            teamResult.rows[0];

        const testProjectName =
            `Natural Language Test Project ${Date.now()}`;

        const testDescription =
            "Created through natural-language AI confirmation test";

        const modelResponse = {
            tool_calls: [
                {
                    name: "create_project",
                    arguments: {
                        name: testProjectName,
                        description:
                            testDescription,
                        team_id: team.id
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
                        `Create a project "${testProjectName}" in the team "${team.name}" with description "${testDescription}".`
                }
            ],
            modelResponse
        });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "create_project should require confirmation"
        );

        assert(
            result.confirmation_id,
            "confirmation_id should be returned"
        );

        assert.strictEqual(
            result.tool_name,
            "create_project",
            "AI should select create_project"
        );

        assert.strictEqual(
            result.tool_arguments.name,
            testProjectName,
            "Project name should be correct"
        );

        assert.strictEqual(
            result.tool_arguments.description,
            testDescription,
            "Project description should be correct"
        );

        assert.strictEqual(
            Number(
                result.tool_arguments.team_id
            ),
            Number(team.id),
            "Team ID should be correct"
        );

        const beforeConfirmation =
            await pool.query(
                `SELECT id
                 FROM projects
                 WHERE name = $1
                   AND team_id = $2`,
                [
                    testProjectName,
                    team.id
                ]
            );

        assert.strictEqual(
            beforeConfirmation.rows.length,
            0,
            "Project must not be created before confirmation"
        );

        console.log(
            "PASS: natural-language create_project resolved team and requires confirmation"
        );

        console.log(
            `Resolved team: ${team.name} (ID ${team.id})`
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
            responseBody.project,
            "Confirmation response should contain created project"
        );

        createdProjectId =
            responseBody.project.id;

        assert.strictEqual(
            responseBody.project.name,
            testProjectName,
            "Created project name should match"
        );

        assert.strictEqual(
            responseBody.project.description,
            testDescription,
            "Created project description should match"
        );

        assert.strictEqual(
            Number(
                responseBody.project.team_id
            ),
            Number(team.id),
            "Created project team should match"
        );

        assert.strictEqual(
            Number(
                responseBody.project.created_by
            ),
            Number(userId),
            "Created project creator should match authenticated user"
        );

        const afterConfirmation =
            await pool.query(
                `SELECT id,
                        name,
                        description,
                        team_id,
                        created_by
                 FROM projects
                 WHERE id = $1`,
                [createdProjectId]
            );

        assert.strictEqual(
            afterConfirmation.rows.length,
            1,
            "Created project should exist in database"
        );

        const createdProject =
            afterConfirmation.rows[0];

        assert.strictEqual(
            createdProject.name,
            testProjectName
        );

        assert.strictEqual(
            createdProject.description,
            testDescription
        );

        assert.strictEqual(
            Number(
                createdProject.team_id
            ),
            Number(team.id)
        );

        assert.strictEqual(
            Number(
                createdProject.created_by
            ),
            Number(userId)
        );

        console.log(
            `PASS: confirmation executed create_project successfully (project ID ${createdProjectId})`
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
                `DELETE FROM projects
                 WHERE id = $1
                   AND created_by = $2
                 RETURNING id`,
                [
                    createdProjectId,
                    userId
                ]
            );

        assert.strictEqual(
            cleanupResult.rows.length,
            1,
            "Test project should be cleaned up"
        );

        createdProjectId = null;

        console.log(
            "PASS: test project cleaned up"
        );

        await stopTestServer(server);
        server = null;

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language create_project execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language create_project execution test failed:"
        );

        console.error(error);

        if (createdProjectId !== null) {
            try {
                await pool.query(
                    `DELETE FROM projects
                     WHERE id = $1`,
                    [createdProjectId]
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