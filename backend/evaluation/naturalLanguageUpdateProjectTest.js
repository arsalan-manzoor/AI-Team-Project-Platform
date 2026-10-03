require("dotenv").config();

const pool = require("../src/config/db");

const BASE_URL = "http://localhost:5000";

async function postJson(path, body, token = null) {
    const response = await fetch(
        `${BASE_URL}${path}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token
                    ? {
                          Authorization: `Bearer ${token}`
                      }
                    : {})
            },
            body: JSON.stringify(body)
        }
    );

    const text = await response.text();

    let parsedBody;

    try {
        parsedBody = JSON.parse(text);
    } catch (error) {
        parsedBody = text;
    }

    return {
        status: response.status,
        body: parsedBody
    };
}

async function run() {
    const email =
        "zyraaitest2026@gmail.com";

    const password =
        process.env.ZYRA_TEST_PASSWORD;

    if (!password) {
        throw new Error(
            "ZYRA_TEST_PASSWORD is not configured in .env"
        );
    }

    const originalName =
        `AI Natural Language Project Source ${Date.now()}`;

    const newName =
        `AI Natural Language Project Updated ${Date.now()}`;

    let temporaryProjectId = null;

    try {
        console.log("Logging in...");

        const loginResponse =
            await postJson(
                "/api/auth/login",
                {
                    email,
                    password
                }
            );

        console.log(
            `Login HTTP status: ${loginResponse.status}`
        );

        if (
            loginResponse.status !== 200 &&
            loginResponse.status !== 201
        ) {
            throw new Error(
                `Login failed. HTTP ${loginResponse.status}. Response: ${JSON.stringify(loginResponse.body)}`
            );
        }

        const token =
            loginResponse.body.token ||
            loginResponse.body.accessToken;

        if (!token) {
            throw new Error(
                `Login succeeded but no token was returned. Response: ${JSON.stringify(loginResponse.body)}`
            );
        }

        console.log(
            "PASS: Login succeeded"
        );

        console.log(
            "\nFinding test user's database ID..."
        );

        const userResult =
            await pool.query(
                `SELECT id
                 FROM users
                 WHERE email = $1`,
                [email]
            );

        if (
            userResult.rows.length !== 1
        ) {
            throw new Error(
                `Expected exactly one test user, found ${userResult.rows.length}`
            );
        }

        const userId =
            userResult.rows[0].id;

        console.log(
            `PASS: Test user ID resolved to ${userId}`
        );

        console.log(
            "\nCreating temporary test project..."
        );

        const createResult =
            await pool.query(
                `INSERT INTO projects
                    (name, description, team_id, created_by)
                 VALUES
                    ($1, $2, $3, $4)
                 RETURNING id, name, description, team_id, created_by`,
                [
                    originalName,
                    "Temporary project for natural-language update evaluation",
                    5,
                    userId
                ]
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

        console.log(
            "\nSending natural-language update request..."
        );

        const response =
            await postJson(
                "/api/ai/chat",
                {
                    messages: [
                        {
                            role: "user",
                            content:
                                `Change the name of my project "${originalName}" to "${newName}".`
                        }
                    ]
                },
                token
            );

        console.log(
            `HTTP status: ${response.status}`
        );

        console.log(
            "Response:",
            JSON.stringify(
                response.body,
                null,
                2
            )
        );

        if (response.status !== 200) {
            throw new Error(
                `AI request failed with HTTP ${response.status}: ${JSON.stringify(response.body)}`
            );
        }

        if (
            response.body.tool_name !==
            "update_project"
        ) {
            throw new Error(
                `Expected update_project, received ${response.body.tool_name}`
            );
        }

        console.log(
            "PASS: Natural-language request selected update_project"
        );

        if (
            response.body.requires_confirmation !==
            true
        ) {
            throw new Error(
                "Expected confirmation to be required"
            );
        }

        console.log(
            "PASS: Confirmation was required"
        );

        if (
            !response.body.confirmation_id
        ) {
            throw new Error(
                "Expected a confirmation ID"
            );
        }

        console.log(
            "PASS: Confirmation ID was returned"
        );

        const resolvedProjectId =
            response.body.tool_arguments?.project_id;

        if (
            resolvedProjectId !==
            temporaryProjectId
        ) {
            throw new Error(
                `Expected project_id ${temporaryProjectId}, but received ${resolvedProjectId}`
            );
        }

        console.log(
            `PASS: Project name resolved to authorized project ID ${temporaryProjectId}`
        );

        const resolvedName =
            response.body.tool_arguments?.name;

        if (
            resolvedName !==
            newName
        ) {
            throw new Error(
                `Expected project name "${newName}", but received "${resolvedName}"`
            );
        }

        console.log(
            "PASS: New project name was preserved correctly"
        );

        console.log(
            "\nChecking database to ensure project was NOT modified..."
        );

        const unchangedResult =
            await pool.query(
                `SELECT id,
                        name
                 FROM projects
                 WHERE id = $1`,
                [temporaryProjectId]
            );

        if (
            unchangedResult.rows.length === 0
        ) {
            throw new Error(
                "Temporary project could not be found after request"
            );
        }

        const currentProject =
            unchangedResult.rows[0];

        console.log(
            `Current database name: "${currentProject.name}"`
        );

        if (
            currentProject.name !==
            originalName
        ) {
            throw new Error(
                "Project was modified before confirmation"
            );
        }

        console.log(
            "PASS: Project was not modified before confirmation"
        );

        console.log(
            "\nNatural-language update_project boundary test passed."
        );
    } finally {
        if (
            temporaryProjectId !== null
        ) {
            await pool.query(
                `DELETE FROM projects
                 WHERE id = $1`,
                [temporaryProjectId]
            );

            console.log(
                "Temporary test project cleaned up."
            );
        }
    }
}

run()
    .catch((error) => {
        console.error(
            "\nNatural-language update_project boundary test failed."
        );

        console.error(
            "Error:",
            error
        );

        console.error(
            "Error message:",
            error?.message ||
                "(no error message)"
        );

        console.error(
            "Error stack:",
            error?.stack ||
                "(no stack available)"
        );

        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });