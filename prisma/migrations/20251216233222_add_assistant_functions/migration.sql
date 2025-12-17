-- CreateTable
CREATE TABLE "assistant_function" (
    "id" TEXT NOT NULL,
    "assistant_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "openai_function_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_function_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_function_assistant_id_idx" ON "assistant_function"("assistant_id");

-- AddForeignKey
ALTER TABLE "assistant_function" ADD CONSTRAINT "assistant_function_assistant_id_fkey" FOREIGN KEY ("assistant_id") REFERENCES "assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
