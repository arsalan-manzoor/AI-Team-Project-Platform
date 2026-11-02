require("dotenv").config();

const http = require("http");

const BASE_URL = "http://localhost:5000";
const EMAIL = "zyraaitest2026@gmail.com";
const PASSWORD = process.env.ZYRA_TEST_PASSWORD;

function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);

        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: options.method || "GET",
                headers: options.headers || {}
            },
            (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    try {
                        resolve({
                            status: res.statusCode,
                            body: JSON.parse(data)
                        });
                    } catch {
                        resolve({
                            status: res.statusCode,
                            body: data
                        });
                    }
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

async function main() {
    if (!PASSWORD) {
        throw new Error(
            "ZYRA_TEST_PASSWORD environment variable is required"
        );
    }

    const login = await request(
        "/api/auth/login",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: {
                email: EMAIL,
                password: PASSWORD
            }
        }
    );

    if (
        login.status !== 200 ||
        !login.body.token
    ) {
        throw new Error("Login failed");
    }

    const response = await request(
        "/api/ai/chat",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${login.body.token}`
            },
            body: {
                messages: [
                    {
                        role: "user",
                        content:
                            "What projects do I have access to? List their names."
                    }
                ]
            }
        }
    );

    console.log("Status:", response.status);
    console.log(
        "Response:",
        JSON.stringify(response.body, null, 2)
    );
}

main().catch((error) => {
    console.error("Test error:", error.message);
    process.exit(1);
});