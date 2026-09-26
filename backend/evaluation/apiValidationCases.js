const BASE_URL = "http://localhost:5000";

async function login() {
    const response = await fetch(
        `${BASE_URL}/api/auth/login`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: "zyraaitest2026@gmail.com",
                password: process.env.ZYRA_TEST_PASSWORD
            })
        }
    );

    const data = await response.json();

    if (!response.ok || !data.token) {
        throw new Error(
            "Test login failed"
        );
    }

    return data.token;
}

async function testCase(
    name,
    token,
    body,
    expectedStatus
) {
    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers.Authorization =
            `Bearer ${token}`;
    }

    const response = await fetch(
        `${BASE_URL}/api/ai/chat`,
        {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        }
    );

    const data = await response.json();

    if (response.status === expectedStatus) {
        console.log(
            `PASS: ${name}`
        );
        return true;
    }

    console.log(
        `FAIL: ${name}`
    );
    console.log(
        `  Expected: ${expectedStatus}`
    );
    console.log(
        `  Received: ${response.status}`
    );
    console.log(
        `  Response: ${JSON.stringify(data)}`
    );

    return false;
}

async function runEvaluation() {
    if (!process.env.ZYRA_TEST_PASSWORD) {
        throw new Error(
            "ZYRA_TEST_PASSWORD environment variable is required"
        );
    }

    const token = await login();

    const cases = [
        {
            name: "missing_token",
            token: null,
            body: {
                messages: [
                    {
                        role: "user",
                        content: "Hello"
                    }
                ]
            },
            expectedStatus: 401
        },

        {
            name: "missing_messages",
            token,
            body: {},
            expectedStatus: 400
        },

        {
            name: "empty_messages",
            token,
            body: {
                messages: []
            },
            expectedStatus: 400
        },

        {
            name: "invalid_role",
            token,
            body: {
                messages: [
                    {
                        role: "invalid",
                        content: "Hello"
                    }
                ]
            },
            expectedStatus: 400
        },

        {
            name: "invalid_content",
            token,
            body: {
                messages: [
                    {
                        role: "user",
                        content: 123
                    }
                ]
            },
            expectedStatus: 400
        }
    ];

    let passed = 0;

    for (const testCaseData of cases) {
        const passedCase = await testCase(
            testCaseData.name,
            testCaseData.token,
            testCaseData.body,
            testCaseData.expectedStatus
        );

        if (passedCase) {
            passed++;
        }
    }

    console.log("");

    console.log(
        "API validation evaluation: " +
        passed +
        "/" +
        cases.length +
        " cases passed"
    );

    if (passed !== cases.length) {
        process.exitCode = 1;
    }
}

runEvaluation().catch((error) => {
    console.error(
        "Evaluation error:",
        error.message
    );
    process.exitCode = 1;
});