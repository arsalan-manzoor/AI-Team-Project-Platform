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

    const testTitle =
        `AI Natural Language Test ${Date.now()}`;

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
        "\nCounting existing test tasks..."
    );

    const beforeResult =
        await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM tasks
             WHERE project_id = $1
               AND title = $2`,
            [6, testTitle]
        );

    const beforeCount =
        beforeResult.rows[0].count;

    console.log(
        `Tasks with test title before request: ${beforeCount}`
    );

    console.log(
        "\nSending natural-language write request..."
    );

    const response =
        await postJson(
            "/api/ai/chat",
            {
                messages: [
                    {
                        role: "user",
                        content:
                            `Create a task called "${testTitle}" in my AI Test Project.`
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
        "create_task"
    ) {
        throw new Error(
            `Expected create_task, received ${response.body.tool_name}`
        );
    }

    console.log(
        "PASS: Natural-language request selected create_task"
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

    if (resolvedProjectId !== 6) {
        throw new Error(
            `Expected project_id 6, but received ${resolvedProjectId}`
        );
    }

    console.log(
        "PASS: Project name resolved to authorized project ID 6"
    );

    const resolvedTitle =
        response.body.tool_arguments?.title;

    if (resolvedTitle !== testTitle) {
        throw new Error(
            `Expected task title "${testTitle}", but received "${resolvedTitle}"`
        );
    }

    console.log(
        "PASS: Task title was preserved correctly"
    );

    console.log(
        "\nChecking database to ensure task was NOT created..."
    );

    const afterResult =
        await pool.query(
            `SELECT COUNT(*)::int AS count
             FROM tasks
             WHERE project_id = $1
               AND title = $2`,
            [6, testTitle]
        );

    const afterCount =
        afterResult.rows[0].count;

    console.log(
        `Tasks with test title after request: ${afterCount}`
    );

    if (afterCount !== beforeCount) {
        throw new Error(
            "Task was created before confirmation"
        );
    }

    console.log(
        "PASS: No task was created before confirmation"
    );

    await pool.query(
        `DELETE FROM tasks
         WHERE project_id = $1
           AND title = $2`,
        [6, testTitle]
    );

    console.log(
        "\nNatural-language write boundary test passed."
    );
}

run()
    .catch((error) => {
        console.error(
            "\nNatural-language write boundary test failed."
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