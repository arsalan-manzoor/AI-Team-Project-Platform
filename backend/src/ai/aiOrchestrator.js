const modelAdapter = require("./modelAdapter");
const tools = require("./toolRegistry");
const { executeTool } = require("./toolExecutor");

const {
    createConfirmation
} = require("../services/aiConfirmation.service");

const {
    getConversation,
    getMessages,
    addMessage
} = require("../services/aiConversation.service");

const {
    getProjectListContext
} = require("../services/projectListContext.service");

const {
    getTaskListContext
} = require("../services/taskListContext.service");

const {
    getTeamListContext
} = require("../services/teamListContext.service");

const MAX_TOOL_ROUNDS = 5;

const ALLOWED_MESSAGE_ROLES = new Set([
    "system",
    "user",
    "assistant",
    "tool"
]);

function validateMessages(messages) {
    if (!Array.isArray(messages)) {
        throw new Error(
            "AI request messages must be an array"
        );
    }

    if (messages.length === 0) {
        throw new Error(
            "AI request must contain at least one message"
        );
    }

    for (const message of messages) {
        if (!message || typeof message !== "object") {
            throw new Error(
                "Each AI message must be an object"
            );
        }

        if (
            typeof message.role !== "string" ||
            !ALLOWED_MESSAGE_ROLES.has(message.role)
        ) {
            throw new Error(
                "AI message role is invalid"
            );
        }

        if (
            typeof message.content !== "string"
        ) {
            throw new Error(
                "AI message content must be a string"
            );
        }
    }
}

function validateClientMessages(messages) {
    validateMessages(messages);

    for (const message of messages) {
        if (message.role !== "user") {
            throw new Error(
                "Client AI messages must use the user role"
            );
        }
    }
}

function buildToolDefinitions() {
    return Object.values(tools).map((tool) => ({
        name: tool.name,
        type: tool.type,
        description: tool.description,
        parameters: tool.parameters,
        returns: tool.returns
    }));
}

function normalizeToolCalls(modelResponse) {
    if (
        Array.isArray(modelResponse.tool_calls) &&
        modelResponse.tool_calls.length > 0
    ) {
        return modelResponse.tool_calls;
    }

    if (modelResponse.tool_call) {
        return [modelResponse.tool_call];
    }

    return [];
}

function buildConversationMessages(
    storedMessages
) {
    return storedMessages.map((message) => ({
        role: message.role,
        content: message.content
    }));
}

async function loadConversationHistory(
    conversationId,
    userId
) {
    const conversation =
        await getConversation(
            conversationId,
            userId
        );

    if (!conversation) {
        throw new Error(
            "AI conversation was not found"
        );
    }

    const storedMessages =
        await getMessages(
            conversationId,
            userId
        );

    return buildConversationMessages(
        storedMessages || []
    );
}

async function persistUserMessages({
    conversationId,
    messages
}) {
    for (const message of messages) {
        if (message.role !== "user") {
            continue;
        }

        await addMessage({
            conversationId,
            role: "user",
            content: message.content
        });
    }
}

function normalizeText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function getUserMessageText(messages) {
    return messages
        .filter(
            (message) =>
                message.role === "user"
        )
        .map(
            (message) =>
                message.content
        )
        .join(" ");
}

async function resolveProjectIdFromUserMessage({
    messages,
    userId
}) {
    const userMessage =
        getUserMessageText(messages);

    const projectContext =
        await getProjectListContext(userId);

    const projects =
        Array.isArray(projectContext?.projects)
            ? projectContext.projects
            : [];

    if (!userMessage || projects.length === 0) {
        return null;
    }

    /*
     * First support the explicit form:
     *
     * project "AI Test Project"
     */
    const explicitProjectMatch =
        userMessage.match(
            /\bproject\s+"([^"]+)"/i
        );

    if (explicitProjectMatch) {
        const requestedName =
            normalizeText(
                explicitProjectMatch[1]
            );

        const matchingProjects =
            projects.filter((project) => {
                return (
                    normalizeText(project.name) ===
                    requestedName
                );
            });

        if (matchingProjects.length === 1) {
            return matchingProjects[0].id;
        }
    }

    /*
     * Also support natural-language references such as:
     *
     * in my AI Test Project
     * in the AI Test Project
     * for my AI Test Project
     *
     * We do not extract an arbitrary project ID from the
     * model response. Instead, we compare authorized
     * project names against the user's message.
     */
    const normalizedMessage =
        normalizeText(userMessage);

    const matchingProjects =
        projects.filter((project) => {
            const normalizedProjectName =
                normalizeText(project.name);

            if (!normalizedProjectName) {
                return false;
            }

            const projectReferencePatterns = [
                `in my ${normalizedProjectName}`,
                `in the ${normalizedProjectName}`,
                `in ${normalizedProjectName}`,
                `for my ${normalizedProjectName}`,
                `for the ${normalizedProjectName}`,
                `for ${normalizedProjectName}`,
                `of my ${normalizedProjectName}`,
                `of the ${normalizedProjectName}`,
                `of ${normalizedProjectName}`,
                `on my ${normalizedProjectName}`,
                `on the ${normalizedProjectName}`,
                `on ${normalizedProjectName}`
            ];

            return projectReferencePatterns.some(
                (pattern) =>
                    normalizedMessage.includes(
                        pattern
                    )
            );
        });

    if (matchingProjects.length === 1) {
        return matchingProjects[0].id;
    }

    /*
     * Finally, if the user's message contains the exact
     * authorized project name as a standalone phrase,
     * allow that name to resolve as well.
     *
     * Word-boundary matching prevents a shorter project
     * name from accidentally matching part of another word.
     */
    const exactNameMatches =
        projects.filter((project) => {
            const normalizedProjectName =
                normalizeText(project.name);

            if (!normalizedProjectName) {
                return false;
            }

            const escapedName =
                normalizedProjectName.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );

            const exactNamePattern =
                new RegExp(
                    `(^|\\s)${escapedName}(?=\\s|$|[.,!?])`,
                    "i"
                );

            return exactNamePattern.test(
                normalizedMessage
            );
        });

    if (exactNameMatches.length !== 1) {
        return null;
    }

    return exactNameMatches[0].id;
}

async function resolveTaskIdFromUserMessage({
    messages,
    userId
}) {
    const userMessage =
        getUserMessageText(messages);

    const taskContext =
        await getTaskListContext(userId);

    const tasks =
        Array.isArray(taskContext?.tasks)
            ? taskContext.tasks
            : [];

    if (!userMessage || tasks.length === 0) {
        return null;
    }

    const taskMatch =
        userMessage.match(
            /task\s+"([^"]+)"/i
        );

    if (!taskMatch) {
        return null;
    }

    const requestedTitle =
        normalizeText(taskMatch[1]);

    const matchingTasks =
        tasks.filter((task) => {
            return (
                normalizeText(task.title) ===
                requestedTitle
            );
        });

    if (matchingTasks.length !== 1) {
        return null;
    }

    return matchingTasks[0].id;
}

async function resolveTeamIdFromUserMessage({
    messages,
    userId
}) {
    const userMessage =
        getUserMessageText(messages);

    const teamContext =
        await getTeamListContext(userId);

    const teams =
        Array.isArray(teamContext?.teams)
            ? teamContext.teams
            : [];

    if (!userMessage || teams.length === 0) {
        return null;
    }

    const quotedValues = [
        ...userMessage.matchAll(/"([^"]+)"/g)
    ].map(
        (match) => match[1].trim()
    );

    if (quotedValues.length === 0) {
        return null;
    }

    const requestedName =
        normalizeText(
            quotedValues[
                quotedValues.length - 1
            ]
        );

    const matchingTeams =
        teams.filter((team) => {
            return (
                normalizeText(team.name) ===
                requestedName
            );
        });

    if (matchingTeams.length !== 1) {
        return null;
    }

    return matchingTeams[0].id;
}

async function resolveCommentTarget({
    toolArguments,
    messages,
    userId
}) {
    const resolvedArguments = {
        ...(toolArguments || {})
    };

    if (
        Number.isInteger(
            resolvedArguments.task_id
        ) ||
        Number.isInteger(
            resolvedArguments.project_id
        )
    ) {
        return resolvedArguments;
    }

    const rawMessage =
        getUserMessageText(messages);

    /*
     * Explicit task target.
     */
    const taskMatch =
        rawMessage.match(
            /\btask\s+"([^"]+)"/i
        );

    if (taskMatch) {
        const requestedTask =
            normalizeText(taskMatch[1]);

        const taskContext =
            await getTaskListContext(userId);

        const tasks =
            Array.isArray(taskContext?.tasks)
                ? taskContext.tasks
                : [];

        const matchingTasks =
            tasks.filter((task) => {
                return (
                    normalizeText(task.title) ===
                    requestedTask
                );
            });

        if (matchingTasks.length === 1) {
            resolvedArguments.task_id =
                matchingTasks[0].id;
        }

        return resolvedArguments;
    }

    /*
     * Explicit project target.
     *
     * Example:
     * Add a comment "Natural Language Project Comment Test"
     * to the project "ZYRA Task Testing"
     */
    const projectMatch =
        rawMessage.match(
            /\bproject\s+"([^"]+)"/i
        );

    if (projectMatch) {
        const requestedProject =
            normalizeText(
                projectMatch[1]
            );

        const projectContext =
            await getProjectListContext(userId);

        const projects =
            Array.isArray(projectContext?.projects)
                ? projectContext.projects
                : [];

        const matchingProjects =
            projects.filter((project) => {
                return (
                    normalizeText(project.name) ===
                    requestedProject
                );
            });

        if (matchingProjects.length === 1) {
            resolvedArguments.project_id =
                matchingProjects[0].id;
        }

        return resolvedArguments;
    }

    return resolvedArguments;
}

async function resolveWriteArguments({
    toolName,
    toolArguments,
    messages,
    userId
}) {
    const resolvedArguments = {
        ...(toolArguments || {})
    };

    if (
        toolName === "create_task"
    ) {
        const projectId =
            await resolveProjectIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(projectId)) {
            resolvedArguments.project_id =
                projectId;
        }
    }

    if (
        toolName === "update_task"
    ) {
        const taskId =
            await resolveTaskIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(taskId)) {
            resolvedArguments.task_id =
                taskId;
        }
    }

    if (
        toolName === "delete_task"
    ) {
        const taskId =
            await resolveTaskIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(taskId)) {
            resolvedArguments.task_id =
                taskId;
        }
    }

    if (
        toolName === "create_project"
    ) {
        const teamId =
            await resolveTeamIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(teamId)) {
            resolvedArguments.team_id =
                teamId;
        }
    }

    if (
        toolName === "update_project"
    ) {
        const projectId =
            await resolveProjectIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(projectId)) {
            resolvedArguments.project_id =
                projectId;
        }
    }

    if (
        toolName === "delete_project"
    ) {
        const projectId =
            await resolveProjectIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(projectId)) {
            resolvedArguments.project_id =
                projectId;
        }
    }

    if (
        toolName === "create_milestone"
    ) {
        const projectId =
            await resolveProjectIdFromUserMessage({
                messages,
                userId
            });

        if (Number.isInteger(projectId)) {
            resolvedArguments.project_id =
                projectId;
        }
    }

    if (
        toolName === "create_comment"
    ) {
        return resolveCommentTarget({
            toolArguments:
                resolvedArguments,
            messages,
            userId
        });
    }

    return resolvedArguments;
}

async function createWriteConfirmation({
    toolName,
    toolArguments,
    userId,
    conversationId
}) {
    const confirmation =
        createConfirmation({
            userId,
            conversationId,
            toolName,
            toolArguments
        });

    return {
        requires_confirmation: true,
        confirmation_id:
            confirmation.confirmationId,
        tool_name:
            confirmation.toolName,
        tool_arguments:
            confirmation.toolArguments,
        message:
            `The AI wants to perform the action "${toolName}". Explicit confirmation is required before it can be executed.`
    };
}

async function runAIRequest({
    messages,
    userId,
    conversationId = null,
    modelResponse = null
}) {
    validateMessages(messages);

    if (!Number.isInteger(userId)) {
        throw new Error(
            "Authenticated user ID must be a valid integer"
        );
    }

    if (
        conversationId !== null &&
        !Number.isInteger(conversationId)
    ) {
        throw new Error(
            "AI conversation ID must be a valid integer"
        );
    }

    console.log(
        "DEBUG AI RUN REQUEST:",
        JSON.stringify(
            {
                messages,
                userId,
                conversationId,
                injectedModelResponse:
                    modelResponse !== null
            },
            null,
            2
        )
    );

    const toolDefinitions =
        buildToolDefinitions();

    let conversation;

    if (conversationId !== null) {
        conversation =
            await loadConversationHistory(
                conversationId,
                userId
            );

        await persistUserMessages({
            conversationId,
            messages
        });

        conversation.push(
            ...messages
                .filter(
                    (message) =>
                        message.role === "user"
                )
                .map((message) => ({
                    role: "user",
                    content: message.content
                }))
        );
    } else {
        conversation = [...messages];
    }

    let injectedModelResponse =
        modelResponse;

    for (
        let round = 0;
        round < MAX_TOOL_ROUNDS;
        round++
    ) {
        let currentModelResponse;

        if (
            injectedModelResponse !== null
        ) {
            currentModelResponse =
                injectedModelResponse;

            injectedModelResponse = null;
        } else {
            currentModelResponse =
                await modelAdapter.generateResponse({
                    messages: conversation,
                    tools: toolDefinitions
                });
        }

        console.log(
            "DEBUG AI MODEL RESPONSE:",
            JSON.stringify(
                currentModelResponse,
                null,
                2
            )
        );

        console.log(
            "DEBUG AI CONVERSATION BEFORE NEXT ROUND:",
            JSON.stringify(
                conversation,
                null,
                2
            )
        );

        if (
            !currentModelResponse ||
            typeof currentModelResponse !== "object"
        ) {
            throw new Error(
                "AI model returned an invalid response"
            );
        }

        const toolCalls =
            normalizeToolCalls(
                currentModelResponse
            );

        console.log(
            "DEBUG AI TOOL CALLS:",
            JSON.stringify(
                toolCalls,
                null,
                2
            )
        );

        if (toolCalls.length === 0) {
            const content =
                currentModelResponse.content || "";

            console.log(
                "DEBUG AI FINAL CONTENT:",
                JSON.stringify(content)
            );

            if (conversationId !== null) {
                await addMessage({
                    conversationId,
                    role: "assistant",
                    content
                });
            }

            return {
                content
            };
        }

        const assistantMessage =
            currentModelResponse.assistant_message || {
                role: "assistant",
                content: ""
            };

        conversation.push({
            role: "assistant",
            content:
                assistantMessage.content || "",
            tool_calls:
                assistantMessage.tool_calls || []
        });

        console.log(
            "DEBUG AI CONVERSATION AFTER ASSISTANT MESSAGE:",
            JSON.stringify(
                conversation,
                null,
                2
            )
        );

        /*
         * Never execute a write tool automatically.
         */
        for (const toolCall of toolCalls) {
            const {
                name,
                arguments: toolArguments
            } = toolCall;

            const tool = tools[name];

            if (!tool) {
                throw new Error(
                    "Unknown AI tool"
                );
            }

            if (tool.type !== "write") {
                continue;
            }

            const resolvedArguments =
                await resolveWriteArguments({
                    toolName: name,
                    toolArguments:
                        toolArguments || {},
                    messages,
                    userId
                });

            if (
                name === "update_task" &&
                !Number.isInteger(
                    resolvedArguments.task_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested task from authorized task data"
                );
            }

            if (
                name === "delete_task" &&
                !Number.isInteger(
                    resolvedArguments.task_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested task from authorized task data"
                );
            }

            if (
                name === "create_task" &&
                !Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested project from authorized project data"
                );
            }

            if (
                name === "create_project" &&
                !Number.isInteger(
                    resolvedArguments.team_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested team from authorized team data"
                );
            }

            if (
                name === "update_project" &&
                !Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested project from authorized project data"
                );
            }

            if (
                name === "delete_project" &&
                !Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested project from authorized project data"
                );
            }

            if (
                name === "create_milestone" &&
                !Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested project from authorized project data"
                );
            }

            if (
                name === "create_comment" &&
                !Number.isInteger(
                    resolvedArguments.task_id
                ) &&
                !Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Unable to resolve the requested comment target from authorized task or project data"
                );
            }

            if (
                name === "create_comment" &&
                Number.isInteger(
                    resolvedArguments.task_id
                ) &&
                Number.isInteger(
                    resolvedArguments.project_id
                )
            ) {
                throw new Error(
                    "Comment must target either a task or a project, not both"
                );
            }

            const confirmation =
                await createWriteConfirmation({
                    toolName: name,
                    toolArguments:
                        resolvedArguments,
                    userId,
                    conversationId
                });

            if (
                conversationId !== null
            ) {
                await addMessage({
                    conversationId,
                    role: "assistant",
                    content:
                        confirmation.message,
                    toolName: name,
                    toolArguments:
                        resolvedArguments,
                    toolResult:
                        confirmation
                });
            }

            return confirmation;
        }

        /*
         * Only read tools are executed.
         */
        for (const toolCall of toolCalls) {
            const {
                name,
                arguments: toolArguments
            } = toolCall;

            const tool = tools[name];

            if (!tool) {
                throw new Error(
                    "Unknown AI tool"
                );
            }

            if (tool.type === "write") {
                continue;
            }

            const toolResult =
                await executeTool(
                    name,
                    toolArguments,
                    userId
                );

            console.log(
                "DEBUG AI TOOL RESULT:",
                JSON.stringify(
                    {
                        name,
                        toolArguments,
                        toolResult
                    },
                    null,
                    2
                )
            );

            if (
                conversationId !== null
            ) {
                await addMessage({
                    conversationId,
                    role: "tool",
                    content:
                        JSON.stringify(
                            toolResult
                        ),
                    toolName: name,
                    toolArguments:
                        toolArguments,
                    toolResult:
                        toolResult
                });
            }

            if (
                toolResult &&
                typeof toolResult === "object" &&
                toolResult.available === false
            ) {
                const content =
                    "No authorized information is available for the requested item.";

                if (
                    conversationId !== null
                ) {
                    await addMessage({
                        conversationId,
                        role: "assistant",
                        content
                    });
                }

                return {
                    content
                };
            }

            conversation.push({
                role: "tool",
                tool_name: name,
                content:
                    JSON.stringify(
                        toolResult
                    )
            });

            console.log(
                "DEBUG AI CONVERSATION AFTER TOOL RESULT:",
                JSON.stringify(
                    conversation,
                    null,
                    2
                )
            );
        }
    }

    throw new Error(
        "AI tool execution exceeded the maximum allowed rounds"
    );
}

module.exports = {
    runAIRequest,
    buildToolDefinitions,
    validateMessages,
    validateClientMessages,
    normalizeToolCalls
};