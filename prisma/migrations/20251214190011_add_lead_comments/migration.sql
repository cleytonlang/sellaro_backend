-- CreateTable
CREATE TABLE "lead_comment" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_comment_lead_id_idx" ON "lead_comment"("lead_id");

-- CreateIndex
CREATE INDEX "lead_comment_user_id_idx" ON "lead_comment"("user_id");

-- CreateIndex
CREATE INDEX "lead_comment_created_at_idx" ON "lead_comment"("created_at");

-- AddForeignKey
ALTER TABLE "lead_comment" ADD CONSTRAINT "lead_comment_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_comment" ADD CONSTRAINT "lead_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
