-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "openai_api_key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "system_prompt" TEXT NOT NULL,
    "initial_message" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "model" TEXT NOT NULL DEFAULT 'gpt-4-turbo-preview',
    "openai_assistant_id" TEXT,
    "enable_scheduling" BOOLEAN NOT NULL DEFAULT true,
    "enable_email" BOOLEAN NOT NULL DEFAULT true,
    "enable_link_sharing" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "settings" JSONB,
    "embed_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assistant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "kanban_column_id" TEXT NOT NULL,
    "form_data" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "referrer_url" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "function_call" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_event" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kanban_column" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_column_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "assistant_userId_idx" ON "assistant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "form_embed_code_key" ON "form"("embed_code");

-- CreateIndex
CREATE INDEX "form_userId_idx" ON "form"("userId");

-- CreateIndex
CREATE INDEX "form_assistant_id_idx" ON "form"("assistant_id");

-- CreateIndex
CREATE INDEX "form_embed_code_idx" ON "form"("embed_code");

-- CreateIndex
CREATE INDEX "lead_form_id_idx" ON "lead"("form_id");

-- CreateIndex
CREATE INDEX "lead_kanban_column_id_idx" ON "lead"("kanban_column_id");

-- CreateIndex
CREATE INDEX "lead_created_at_idx" ON "lead"("created_at");

-- CreateIndex
CREATE INDEX "lead_deleted_at_idx" ON "lead"("deleted_at");

-- CreateIndex
CREATE INDEX "conversation_lead_id_idx" ON "conversation"("lead_id");

-- CreateIndex
CREATE INDEX "conversation_assistant_id_idx" ON "conversation"("assistant_id");

-- CreateIndex
CREATE INDEX "message_conversation_id_idx" ON "message"("conversation_id");

-- CreateIndex
CREATE INDEX "message_created_at_idx" ON "message"("created_at");

-- CreateIndex
CREATE INDEX "lead_event_lead_id_idx" ON "lead_event"("lead_id");

-- CreateIndex
CREATE INDEX "lead_event_type_idx" ON "lead_event"("type");

-- CreateIndex
CREATE INDEX "lead_event_created_at_idx" ON "lead_event"("created_at");

-- CreateIndex
CREATE INDEX "kanban_column_form_id_idx" ON "kanban_column"("form_id");

-- CreateIndex
CREATE INDEX "kanban_column_order_idx" ON "kanban_column"("order");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant" ADD CONSTRAINT "assistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form" ADD CONSTRAINT "form_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_kanban_column_id_fkey" FOREIGN KEY ("kanban_column_id") REFERENCES "kanban_column"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_event" ADD CONSTRAINT "lead_event_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kanban_column" ADD CONSTRAINT "kanban_column_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
