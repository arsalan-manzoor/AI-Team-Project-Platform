require("dotenv").config();

const pool = require("../src/config/db");
const {
    runAIRequest
} = require("../src/ai/aiOrchestrator");

async function main() {
    const userId = 1;

    const projectsBeforeResult = await pool.query(
        `SELECT id, name, description, team_id, created_by
         FROM projects
         ORDER BY id`
    );

    const projectsBefore = projectsBeforeResult.rows;

    const projectResult = await pool.query(
        `SELECT projects.id, projects.name
         FROM projects
         JOIN team_members
            ON projects.team_id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY projects.id
         LIMIT 1`,
        [userId]
    );

    if (projectResult.rows.length === 0) {
        throw new Error(
            "No authorized project found for test user"
        );
    }

    const project = projectResult.rows[0];

    const modelResponse = {
        tool_calls: [
            {
                name: "create_milestone",
                arguments: {
                    name: "Natural Language Test Milestone",
                    description:
                        "Created through natural language",
                    project_id: null,
                    deadline: "2026-12-31"
                }
            }
        ]
    };

    const result = await runAIRequest({
        userId,
        messages: [
            {
                role: "user",
                content:
                    `Create a milestone named "Natural Language Test Milestone" in the project "${project.name}"`
            }
        ],
        modelResponse
    });

    if (
        !result ||
        !result.requires_confirmation
    ) {
        throw new Error(
            "Expected create_milestone to require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Expected a confirmation ID"
        );
    }

    if (
        result.tool_name !==
        "create_milestone"
    ) {
        throw new Error(
            "Expected create_milestone tool"
        );
    }

    if (
        result.tool_arguments.project_id !==
        project.id
    ) {
        throw new Error(
            `Expected project ID ${project.id}, received ${result.tool_arguments.project_id}`
        );
    }

    if (
        result.tool_arguments.name !==
        "Natural Language Test Milestone"
    ) {
        throw new Error(
            "Milestone name was not preserved correctly"
        );
    }

    const projectsAfterResult = await pool.query(
        `SELECT id, name, description, team_id, created_by
         FROM projects
         ORDER BY id`
    );

    const projectsAfter = projectsAfterResult.rows;

    if (
        projectsAfter.length !==
        projectsBefore.length
    ) {
        throw new Error(
            "Project data changed unexpectedly"
        );
    }

    const milestoneResult = await pool.query(
        `SELECT id
         FROM milestones
         WHERE name = $1`,
        ["Natural Language Test Milestone"]
    );

    if (milestoneResult.rows.length > 0) {
        throw new Error(
            "Milestone was created before confirmation"
        );
    }

    console.log(
        "PASS: natural-language create_milestone resolved project and requires confirmation"
    );

    console.log(
        `Resolved project: ${project.name} (ID ${project.id})`
    );

    console.log(
        "PASS: milestone was not created before confirmation"
    );
}

main()
    .catch((error) => {
        console.error(
            "FAIL:",
            error.message
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });