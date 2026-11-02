require("dotenv").config();

const http = require("http");

const email = "zyraaitest2026@gmail.com";

function request(url, options, body) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);

        const req = http.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname,
                method: options.method,
                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            },
            (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    resolve({
                        status: res.statusCode,
                        body: data
                    });
                });
            }
        );

        req.on("error", reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function run() {
    const password = process.env.ZYRA_TEST_PASSWORD;

    if (!password) {
        console.log("ZYRA_TEST_PASSWORD is not set.");
        console.log("Use the test account password locally in this file.");
        return;
    }

    const login = await request(
        "http://localhost:5000/api/auth/login",
        {
            method: "POST"
        },
        {
            email,
            password
        }
    );

    console.log("Login status:", login.status);

    const loginData = JSON.parse(login.body);

    if (!loginData.token) {
        console.log("Login failed:", login.body);
        return;
    }

    const ai = await request(
        "http://localhost:5000/api/ai/chat",
        {
            method: "POST",
            headers: {
                Authorization: "Bearer " + loginData.token
            }
        },
        {
            messages: [
                {
                    role: "user",
                    content: "Tell me the name of project 6 and its team ID."
                }
            ]
        }
    );

    console.log("AI status:", ai.status);
    console.log("AI response:", ai.body);
}

run().catch((error) => {
    console.error("Test failed:", error.message);
});
