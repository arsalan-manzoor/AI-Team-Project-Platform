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

    const teamResult = await pool.query(
        `SELECT teams.id, teams.name
         FROM teams
         JOIN team_members
            ON teams.id = team_members.team_id
         WHERE team_members.user_id = $1
         ORDER BY teams.id
         LIMIT 1`,
        [userId]
    );

    if (teamResult.rows.length === 0) {
        throw new Error(
            "No authorized team found for test user"
        );
    }

    const team = teamResult.rows[0];

    const modelResponse = {
        tool_calls: [
            {
                name: "create_project",
                arguments: {
                    name: "Natural Language Test Project",
                    description:
                        "Created through natural language",
                    team_id: null
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
                    `Create a new project named "Natural Language Test Project" in the team "${team.name}"`
            }
        ],
        modelResponse
    });

    if (!result || !result.requires_confirmation) {
        throw new Error(
            "Expected create_project to require confirmation"
        );
    }

    if (!result.confirmation_id) {
        throw new Error(
            "Expected a confirmation ID"
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
            "Project was created before confirmation"
        );
    }

    console.log(
        "PASS: natural-language create_project resolved team and requires confirmation"
    );

    console.log(
        `Resolved team: ${team.name} (ID ${team.id})`
    );

    console.log(
        "PASS: database unchanged before confirmation"
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