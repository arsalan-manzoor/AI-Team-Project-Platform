CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL
        REFERENCES public.users(id)
        ON DELETE CASCADE,

    title TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
    id SERIAL PRIMARY KEY,

    conversation_id INTEGER NOT NULL
        REFERENCES public.ai_conversations(id)
        ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('system', 'user', 'assistant', 'tool')),

    content TEXT NOT NULL DEFAULT '',

    tool_name TEXT,

    tool_arguments JSONB,

    tool_result JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
    ON public.ai_conversations (user_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
    ON public.ai_messages (conversation_id, id ASC);
