const assert = require("assert");
require("dotenv").config();

const http = require("http");

const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

const {
    createProject,
    deleteProject
} = require("../src/services/project.service");

const pool = require("../src/config/db");

const app = require("../src/app");

const jwt = require("jsonwebtoken");

const TEST_USER_ID = 1;
const TEST_TEAM_ID = 2;

let server = null;

function startTestServer() {
    return new Promise((resolve, reject) => {
        server = http.createServer(app);

        server.once("error", reject);

        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            resolve(
                `http://127.0.0.1:${address.port}`
            );
        });
    });
}

function stopTestServer() {
    return new Promise((resolve, reject) => {
        if (!server) {
            resolve();
            return;
        }

        server.close((error) => {
            server = null;

            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function createTestToken() {
    return jwt.sign(
        {
            id: TEST_USER_ID
        },
        process.env.JWT_SECRET
    );
}

async function postConfirmation(
    baseUrl,
    token,
    confirmationId
) {
    return new Promise((resolve, reject) => {
        const url =
            new URL(
                "/api/ai/confirm",
                baseUrl
            );

        const body =
            JSON.stringify({
                confirmationId
            });

        const request =
            http.request(
                {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname,
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json",
                        "Content-Length":
                            Buffer.byteLength(body),
                        Authorization:
                            `Bearer ${token}`
                    }
                },
                (response) => {
                    let data = "";

                    response.on(
                        "data",
                        (chunk) => {
                            data += chunk;
                        }
                    );

                    response.on(
                        "end",
                        () => {
                            let parsed = null;

                            try {
                                parsed =
                                    data
                                        ? JSON.parse(data)
                                        : null;
                            } catch {
                                parsed = data;
                            }

                            resolve({
                                status:
                                    response.statusCode,
                                body:
                                    parsed
                            });
                        }
                    );
                }
            );

        request.on(
            "error",
            reject
        );

        request.write(body);
        request.end();
    });
}

async function cleanupProject(projectId) {
    if (!projectId) {
        return;
    }

    try {
        await deleteProject({
            projectId,
            userId: TEST_USER_ID
        });
    } catch {
        /*
         * The project may already have been
         * deleted successfully by the test.
         */
    }
}

async function main() {
    let projectId = null;
    let baseUrl = null;

    const originalName =
        `Natural Language Delete Project Test ${Date.now()}`;

    try {
        const project =
            await createProject({
                name: originalName,
                description:
                    "Temporary project for natural-language delete_project execution testing",
                teamId: TEST_TEAM_ID,
                userId: TEST_USER_ID
            });

        projectId = project.id;

        console.log(
            `Created temporary project: ${originalName} (ID ${projectId})`
        );

        const messages = [
            {
                role: "user",
                content:
                    `Delete the project "${originalName}".`
            }
        ];

        const modelResponse = {
            tool_calls: [
                {
                    name: "delete_project",
                    arguments: {
                        project_id: null
                    }
                }
            ],
            assistant_message: {
                role: "assistant",
                content: ""
            }
        };

        const result =
            await runAIRequest({
                messages,
                userId: TEST_USER_ID,
                modelResponse
            });

        assert.strictEqual(
            result.requires_confirmation,
            true,
            "delete_project should require confirmation"
        );

        assert.strictEqual(
            result.tool_name,
            "delete_project",
            "Correct write tool should be selected"
        );

        assert.strictEqual(
            result.tool_arguments.project_id,
            projectId,
            "Project ID should be resolved correctly"
        );

        console.log(
            "PASS: natural-language delete_project resolved project and requires confirmation"
        );

        console.log(
            `Resolved project: ${originalName} (ID ${projectId})`
        );

        const confirmationId =
            result.confirmation_id;

        assert.ok(
            confirmationId,
            "Confirmation ID should be returned"
        );

        const projectBeforeConfirmation =
            await pool.query(
                `SELECT id, name
                 FROM projects
                 WHERE id = $1`,
                [projectId]
            );

        assert.strictEqual(
            projectBeforeConfirmation.rows.length,
            1,
            "Project should still exist before confirmation"
        );

        baseUrl =
            await startTestServer();

        console.log(
            `Test API started at ${baseUrl}`
        );

        const token =
            createTestToken();

        const confirmationResponse =
            await postConfirmation(
                baseUrl,
                token,
                confirmationId
            );

        assert.strictEqual(
            confirmationResponse.status,
            200,
            "Confirmation should execute delete_project successfully"
        );

        console.log(
            `PASS: confirmation executed delete_project successfully (project ID ${projectId})`
        );

        const projectAfterConfirmation =
            await pool.query(
                `SELECT id
                 FROM projects
                 WHERE id = $1`,
                [projectId]
            );

        assert.strictEqual(
            projectAfterConfirmation.rows.length,
            0,
            "Project should be deleted from database"
        );

        console.log(
            "PASS: project was deleted from database"
        );

        const reuseResponse =
            await postConfirmation(
                baseUrl,
                token,
                confirmationId
            );

        assert.strictEqual(
            reuseResponse.status,
            404,
            "Used confirmation should not be reusable"
        );

        console.log(
            "PASS: confirmation cannot be reused"
        );

        await stopTestServer();

        console.log(
            "PASS: test API stopped"
        );

        console.log(
            "\nNatural-language delete_project execution test passed completely."
        );
    } catch (error) {
        console.error(
            "\nNatural-language delete_project execution test failed:"
        );

        console.error(error);

        if (server) {
            try {
                await stopTestServer();
            } catch {}
        }

        await cleanupProject(projectId);

        console.log(
            "PASS: failed-test project cleaned up"
        );

        process.exitCode = 1;
    } finally {
        if (server) {
            try {
                await stopTestServer();
            } catch {}
        }

        await pool.end();
    }
}

main();