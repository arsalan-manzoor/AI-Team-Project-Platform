const {
    calculateDeadlineIntelligence
} = require("../src/services/projectIntelligence.service");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runTest(name, testFunction) {
    try {
        testFunction();
        console.log(`PASS: ${name}`);
        return true;
    } catch (error) {
        console.error(`FAIL: ${name}`);
        console.error(error.message);
        return false;
    }
}

const referenceDate = new Date("2026-10-08T12:00:00.000Z");

const tests = [
    [
        "counts tasks without deadlines",
        () => {
            const result = calculateDeadlineIntelligence(
                {
                    tasks: [
                        {
                            id: 1,
                            deadline: null
                        },
                        {
                            id: 2,
                            deadline: null
                        }
                    ]
                },
                referenceDate
            );

            assert(result.total_tasks === 2, "Expected 2 total tasks.");
            assert(
                result.tasks_with_deadlines === 0,
                "Expected 0 tasks with deadlines."
            );
            assert(
                result.tasks_without_deadlines === 2,
                "Expected 2 tasks without deadlines."
            );
        }
    ],

    [
        "detects overdue tasks",
        () => {
            const result = calculateDeadlineIntelligence(
                {
                    tasks: [
                        {
                            id: 1,
                            deadline: "2026-10-01T12:00:00.000Z"
                        },
                        {
                            id: 2,
                            deadline: "2026-10-20T12:00:00.000Z"
                        }
                    ]
                },
                referenceDate
            );

            assert(
                result.overdue_tasks === 1,
                "Expected 1 overdue task."
            );
        }
    ],

    [
        "detects tasks due within seven days",
        () => {
            const result = calculateDeadlineIntelligence(
                {
                    tasks: [
                        {
                            id: 1,
                            deadline: "2026-10-10T12:00:00.000Z"
                        },
                        {
                            id: 2,
                            deadline: "2026-10-15T12:00:00.000Z"
                        },
                        {
                            id: 3,
                            deadline: "2026-10-20T12:00:00.000Z"
                        }
                    ]
                },
                referenceDate
            );

            assert(
                result.tasks_due_soon === 2,
                "Expected 2 tasks due within seven days."
            );
        }
    ],

    [
        "calculates deadline coverage",
        () => {
            const result = calculateDeadlineIntelligence(
                {
                    tasks: [
                        {
                            id: 1,
                            deadline: "2026-10-10T12:00:00.000Z"
                        },
                        {
                            id: 2,
                            deadline: null
                        },
                        {
                            id: 3,
                            deadline: "2026-10-20T12:00:00.000Z"
                        },
                        {
                            id: 4,
                            deadline: null
                        }
                    ]
                },
                referenceDate
            );

            assert(
                result.deadline_coverage_percentage === 50,
                "Expected deadline coverage to be 50%."
            );
        }
    ],

    [
        "handles an empty project",
        () => {
            const result = calculateDeadlineIntelligence(
                {
                    tasks: []
                },
                referenceDate
            );

            assert(result.total_tasks === 0, "Expected 0 total tasks.");
            assert(
                result.overdue_tasks === 0,
                "Expected 0 overdue tasks."
            );
            assert(
                result.tasks_due_soon === 0,
                "Expected 0 tasks due soon."
            );
            assert(
                result.deadline_coverage_percentage === 0,
                "Expected 0% deadline coverage."
            );
        }
    ]
];

let passed = 0;

for (const [name, testFunction] of tests) {
    if (runTest(name, testFunction)) {
        passed++;
    }
}

console.log("");
console.log(`RESULT: ${passed}/${tests.length} tests passed.`);

if (passed !== tests.length) {
    process.exit(1);
}