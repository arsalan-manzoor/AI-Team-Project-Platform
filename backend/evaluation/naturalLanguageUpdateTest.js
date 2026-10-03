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

    const originalTitle =
        `AI Natural Language Update Source ${Date.now()}`;

    const newTitle =
        `AI Natural Language Updated ${Date.now()}`;

    let temporaryTaskId = null;

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
            "\nCreating temporary test task..."
        );

        const createResult =
            await pool.query(
                `INSERT INTO tasks
                    (project_id, title, created_by)
                 VALUES
                    ($1, $2, $3)
                 RETURNING id, title, project_id, created_by`,
                [
                    6,
                    originalTitle,
                    userId
                ]
            );

        const temporaryTask =
            createResult.rows[0];

        temporaryTaskId =
            temporaryTask.id;

        console.log(
            `PASS: Temporary task created with ID ${temporaryTaskId}`
        );

        console.log(
            `Temporary task title: "${temporaryTask.title}"`
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
                                `Change the title of my task "${originalTitle}" to "${newTitle}".`
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
            "update_task"
        ) {
            throw new Error(
                `Expected update_task, received ${response.body.tool_name}`
            );
        }

        console.log(
            "PASS: Natural-language request selected update_task"
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

        const resolvedTaskId =
            response.body.tool_arguments?.task_id;

        if (
            resolvedTaskId !==
            temporaryTaskId
        ) {
            throw new Error(
                `Expected task_id ${temporaryTaskId}, but received ${resolvedTaskId}`
            );
        }

        console.log(
            `PASS: Task name resolved to authorized task ID ${temporaryTaskId}`
        );

        const resolvedTitle =
            response.body.tool_arguments?.title;

        if (
            resolvedTitle !==
            newTitle
        ) {
            throw new Error(
                `Expected title "${newTitle}", but received "${resolvedTitle}"`
            );
        }

        console.log(
            "PASS: New task title was preserved correctly"
        );

        console.log(
            "\nChecking database to ensure task was NOT modified..."
        );

        const unchangedResult =
            await pool.query(
                `SELECT id,
                        title
                 FROM tasks
                 WHERE id = $1`,
                [temporaryTaskId]
            );

        if (
            unchangedResult.rows.length === 0
        ) {
            throw new Error(
                "Temporary task could not be found after request"
            );
        }

        const currentTask =
            unchangedResult.rows[0];

        console.log(
            `Current database title: "${currentTask.title}"`
        );

        if (
            currentTask.title !==
            originalTitle
        ) {
            throw new Error(
                "Task was modified before confirmation"
            );
        }

        console.log(
            "PASS: Task was not modified before confirmation"
        );

        console.log(
            "\nNatural-language update boundary test passed."
        );
    } finally {
        if (
            temporaryTaskId !== null
        ) {
            await pool.query(
                `DELETE FROM tasks
                 WHERE id = $1`,
                [temporaryTaskId]
            );

            console.log(
                "Temporary test task cleaned up."
            );
        }
    }
}

run()
    .catch((error) => {
        console.error(
            "\nNatural-language update boundary test failed."
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