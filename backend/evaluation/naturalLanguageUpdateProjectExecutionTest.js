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
    let temporaryProjectId = null;
    let confirmationId = null;

    try {
        const userId = 1;

        assert(
            process.env.JWT_SECRET,
            "JWT_SECRET must be configured"
        );

        const projectResult =
            await pool.query(
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

        const sourceProject =
            projectResult.rows[0];

        const originalName =
            `AI Update Project Execution Source ${Date.now()}`;

        const newName =
            `AI Update Project Execution Updated ${Date.now()}`;

        const createResult =
            await pool.query(
                `INSERT INTO projects
                    (name, description, team_id, created_by)
                 SELECT
                    $1,
                    $2,
                    team_id,
                    $3
                 FROM projects
                 WHERE id = $4
                 RETURNING id, name, description, team_id, created_by`,
                [
                    originalName,
                    "Temporary project for natural-language update execution evaluation",
                    userId,
                    sourceProject.id
                ]
            );

        assert.strictEqual(
            createResult.rows.length,
            1,
            "Temporary project should be created"
        );

        const temporaryProject =
            createResult.rows[0];

        temporaryProjectId =
            temporaryProject.id;

        console.log(
            `PASS: Temporary project created with ID ${temporaryProjectId}`
        );

        console.log(
            `Temporary project name: "${temporaryProject.name}"`
        );

        const modelResponse = {
            tool_calls: [
                {
                    name: "update_project",
                    arguments: {
                        project_id: temporaryProjectId,
                        name: newName,
                        description:
                            temporaryProject.description
                    }
                }
            ]
        };

        console.log(
            "\nSending natural-language update request..."
        );

        const result =
            await runAIRequest({
                userId,
                messages: [
                    {
                        role: "user",
                        content:
                            `Change the name of my project "${originalName}" to "${newName}".`
                    }
                ],
                modelResponse
            });

        assert(
            result,
            "AI response should exist"
        );

        assert.strictEqual(
            result.tool_name,
            "update_project",
            "AI should select update_project"
        );

        console.log(
            "PASS: Natural-language request selected update_project"
        );

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "update_project should require confirmation"
        );

        console.log(
            "PASS: Confirmation was required"
        );

        confirmationId =
            result.confirmation_id;

        assert(
            confirmationId,
            "Expected a confirmation ID"
        );

        console.log(
            `PASS: Confirmation ID received: ${confirmationId}`
        );

        assert.strictEqual(
            Number(
                result.tool_arguments.project_id
            ),
            Number(temporaryProjectId),
            "Correct project ID should be resolved"
        );

        console.log(
            "PASS: Correct project ID was resolved"
        );

        assert.strictEqual(
            result.tool_arguments.name,
            newName,
            "Correct new project name should be prepared"
        );

        console.log(
            "PASS: Correct new project name was prepared"
        );

        const beforeConfirmationResult =
            await pool.query(
                `SELECT id,
                        name
                 FROM projects
                 WHERE id = $1`,
                [temporaryProjectId]
            );

        assert.strictEqual(
            beforeConfirmationResult.rows.length,
            1,
            "Temporary project should exist before confirmation"
        );

        assert.strictEqual(
            beforeConfirmationResult.rows[0].name,
            originalName,
            "Project must remain unchanged before confirmation"
        );

        console.log(
            "PASS: Project was unchanged before confirmation"
        );

        const {
            server: testServer,
            baseUrl
        } = await startTestServer();

        server = testServer;

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token =
            jwt.sign(
                {
                    id: userId
                },
                process.env.JWT_SECRET
            );

        console.log(
            "\nConfirming update_project..."
        );

        const confirmationResponse =
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
                            confirmationId
                    })
                }
            );

        const confirmationBody =
            await confirmationResponse.json();

        console.log(
            `Confirmation HTTP status: ${confirmationResponse.status}`
        );

        console.log(
            "Confirmation response:",
            JSON.stringify(
                confirmationBody,
                null,
                2
            )
        );

        assert.strictEqual(
            confirmationResponse.status,
            200,
            `Confirmation should succeed. Received ${confirmationResponse.status}`
        );

        console.log(
            "PASS: update_project confirmation executed successfully"
        );

        const afterConfirmationResult =
            await pool.query(
                `SELECT id,
                        name
                 FROM projects
                 WHERE id = $1`,
                [temporaryProjectId]
            );

        assert.strictEqual(
            afterConfirmationResult.rows.length,
            1,
            "Temporary project should exist after confirmation"
        );

        const updatedProject =
            afterConfirmationResult.rows[0];

        assert.strictEqual(
            updatedProject.name,
            newName,
            "Project name should be updated correctly"
        );

        console.log(
            "PASS: Project name was updated correctly after confirmation"
        );

        console.log(
            "\nChecking that confirmation cannot be reused..."
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
                            confirmationId
                    })
                }
            );

        assert.notStrictEqual(
            reuseResponse.status,
            200,
            "Confirmation must not be reusable"
        );

        console.log(
            "PASS: Confirmation was consumed and cannot be reused"
        );

        await pool.query(
            `DELETE FROM projects
             WHERE id = $1`,
            [temporaryProjectId]
        );

        temporaryProjectId = null;

        console.log(
            "PASS: Temporary project cleaned up"
        );

        await stopTestServer(server);

        server = null;

        console.log(
            "PASS: Test API stopped"
        );

        console.log(
            "\nNatural-language update_project execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language update_project execution test failed:"
        );

        console.error(error);

        if (temporaryProjectId !== null) {
            try {
                await pool.query(
                    `DELETE FROM projects
                     WHERE id = $1`,
                    [temporaryProjectId]
                );

                console.log(
                    "Temporary project cleaned up after failure."
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