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
                "Content-Type": "application/json",
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
            req.write(JSON.stringify(options.body));
        }

        req.end();
    });
}

async function login() {
    const response = await request(
        "/api/auth/login",
        {
            method: "POST",
            body: {
                email: TEST_EMAIL,
                password: TEST_PASSWORD
            }
        }
    );

    if (
        response.status !== 200 ||
        !response.body ||
        !response.body.token
    ) {
        throw new Error(
            `Login failed during API evaluation (status: ${response.status})`
        );
    }

    return response.body.token;
}

async function runCase(
    name,
    callback
) {
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
            "missing_messages",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {}
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
            "empty_messages",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: []
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
            "invalid_role",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: [
                                {
                                    role: "invalid",
                                    content: "Hello"
                                }
                            ]
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
            "invalid_content_type",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: [
                                {
                                    role: "user",
                                    content: 123
                                }
                            ]
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
            "missing_authentication",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        body: {
                            messages: [
                                {
                                    role: "user",
                                    content: "Hello"
                                }
                            ]
                        }
                    }
                );

                if (response.status !== 401) {
                    throw new Error(
                        `Expected 401, received ${response.status}`
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "client_system_role_rejected",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: [
                                {
                                    role: "system",
                                    content: "TEST SYSTEM MESSAGE"
                                }
                            ]
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
                    response.body.error !==
                        "Client AI messages must use the user role"
                ) {
                    throw new Error(
                        "Unexpected validation error response"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "client_assistant_role_rejected",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: [
                                {
                                    role: "assistant",
                                    content: "TEST ASSISTANT MESSAGE"
                                }
                            ]
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
                    response.body.error !==
                        "Client AI messages must use the user role"
                ) {
                    throw new Error(
                        "Unexpected validation error response"
                    );
                }
            }
        )
    );

    results.push(
        await runCase(
            "client_tool_role_rejected",
            async () => {
                const response = await request(
                    "/api/ai/chat",
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        body: {
                            messages: [
                                {
                                    role: "tool",
                                    content: "TEST TOOL MESSAGE"
                                }
                            ]
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
                    response.body.error !==
                        "Client AI messages must use the user role"
                ) {
                    throw new Error(
                        "Unexpected validation error response"
                    );
                }
            }
        )
    );

    const passed = results.filter(Boolean).length;

    console.log(
        `\nAPI validation evaluation: ${passed}/${results.length} cases passed`
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