-- AlterTable
ALTER TABLE "assistant" ADD COLUMN     "max_completion_tokens" INTEGER DEFAULT 500,
ADD COLUMN     "max_prompt_tokens" INTEGER;
