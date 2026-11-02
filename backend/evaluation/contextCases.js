const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env")
});

const http = require("http");

const BASE_URL = "http://localhost:5000";
const TEST_EMAIL = "zyraaitest2026@gmail.com";
const TEST_PASSWORD = process.env.ZYRA_TEST_PASSWORD;

if (!TEST_PASSWORD) {
    console.error(
        "Evaluation error: ZYRA_TEST_PASSWORD environment variable is required"
    );
    process.exit(1);
}

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);

        const requestOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || "GET",
            headers: {
                ...(options.headers || {})
            }
        };

        const req = http.request(
            requestOptions,
            (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    let body = data;

                    try {
                        body = JSON.parse(data);
                    } catch {
                        // Keep non-JSON response as text.
                    }

                    resolve({
                        status: res.statusCode,
                        body
                    });
                });
            }
        );

        req.on("error", reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function login() {
    const response = await request(
        "/api/auth/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            })
        }
    );

    if (
        response.status !== 200 ||
        !response.body ||
        !response.body.token
    ) {
        throw new Error(
            `Login failed during context evaluation (status: ${response.status})`
        );
    }

    return response.body.token;
}

async function runCase(name, callback) {
    try {
        await callback();
        console.log(`PASS: ${name}`);
        return true;
    } catch (error) {
        console.log(`FAIL: ${name}`);
        console.log(`  Reason: ${error.message}`);
        return false;
    }
}

async function main() {
    const token = await login();

    const results = [];

    results.push(
        await runCase(
            "user_tasks_context",
            async () => {
                const response = await request(
                    "/api/ai/context/user_tasks",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "user_tasks" ||
                    response.body.available !== true
                ) {
                    throw new Error(
                        "Invalid user_tasks context contract"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "authorized_team_context",
            async () => {
                const response = await request(
                    "/api/ai/context/team?id=5",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "team" ||
                    response.body.available !== true ||
                    !response.body.data ||
                    !response.body.data.team ||
                    response.body.data.team.id !== 5
                ) {
                    throw new Error(
                        "Invalid authorized team context"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "unauthorized_team_context",
            async () => {
                const response = await request(
                    "/api/ai/context/team?id=2",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "team" ||
                    response.body.available !== false ||
                    response.body.data !== null
                ) {
                    throw new Error(
                        "Unauthorized team context was not safely denied"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "authorized_project_context",
            async () => {
                const response = await request(
                    "/api/ai/context/project?id=6",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "project" ||
                    response.body.available !== true ||
                    !response.body.data ||
                    !response.body.data.project ||
                    response.body.data.project.id !== 6
                ) {
                    throw new Error(
                        "Invalid authorized project context"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "unauthorized_project_context",
            async () => {
                const response = await request(
                    "/api/ai/context/project?id=2",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "project" ||
                    response.body.available !== false ||
                    response.body.data !== null
                ) {
                    throw new Error(
                        "Unauthorized project context was not safely denied"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "authorized_recent_activity_context",
            async () => {
                const response = await request(
                    "/api/ai/context/recent_activity?id=6",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "recent_activity" ||
                    response.body.available !== true ||
                    !response.body.data ||
                    !response.body.data.scope ||
                    response.body.data.scope.project_id !== 6 ||
                    !Array.isArray(
                        response.body.data.recent_activity
                    )
                ) {
                    throw new Error(
                        "Invalid authorized recent activity context"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "unauthorized_recent_activity_context",
            async () => {
                const response = await request(
                    "/api/ai/context/recent_activity?id=2",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "recent_activity" ||
                    response.body.available !== false ||
                    response.body.data !== null
                ) {
                    throw new Error(
                        "Unauthorized recent activity context was not safely denied"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "unauthorized_task_context",
            async () => {
                const response = await request(
                    "/api/ai/context/task?id=2",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "task" ||
                    response.body.available !== false ||
                    response.body.data !== null
                ) {
                    throw new Error(
                        "Unauthorized task context was not safely denied"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "nonexistent_milestone_context",
            async () => {
                const response = await request(
                    "/api/ai/context/milestone?id=9999",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 200) {
                    throw new Error(
                        `Expected 200, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.context_type !== "milestone" ||
                    response.body.available !== false ||
                    response.body.data !== null
                ) {
                    throw new Error(
                        "Nonexistent milestone context was not safely denied"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "missing_context_id",
            async () => {
                const response = await request(
                    "/api/ai/context/project",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 400) {
                    throw new Error(
                        `Expected 400, received ${response.status}`
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "invalid_context_id",
            async () => {
                const response = await request(
                    "/api/ai/context/project?id=abc",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 400) {
                    throw new Error(
                        `Expected 400, received ${response.status}`
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "invalid_context_type",
            async () => {
                const response = await request(
                    "/api/ai/context/invalid_type?id=6",
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                if (response.status !== 400) {
                    throw new Error(
                        `Expected 400, received ${response.status}`
                    );
                }

                if (
                    !response.body ||
                    response.body.error !== "Invalid AI context type"
                ) {
                    throw new Error(
                        "Invalid context type error response is incorrect"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "missing_authentication",
            async () => {
                const response = await request(
                    "/api/ai/context/project?id=6"
                );

                if (response.status !== 401) {
                    throw new Error(
                        `Expected 401, received ${response.status}`
                    );
                }
            }
        )
    );

    const passed = results.filter(Boolean).length;

    console.log(
        `\nExpanded Context API evaluation: ${passed}/${results.length} cases passed`
    );

    if (passed !== results.length) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Evaluation error:", error.message);
    console.error(error.stack);
    process.exit(1);
});