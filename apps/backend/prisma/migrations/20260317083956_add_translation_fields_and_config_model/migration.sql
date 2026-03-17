-- CreateEnum
CREATE TYPE "TranslationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Translation" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "priority" "TranslationPriority" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "submitterId" TEXT;

-- CreateTable
CREATE TABLE "Config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Config_key_key" ON "Config"("key");

-- CreateIndex
CREATE INDEX "Config_key_idx" ON "Config"("key");

-- CreateIndex
CREATE INDEX "Translation_status_submitterId_idx" ON "Translation"("status", "submitterId");

-- CreateIndex
CREATE INDEX "Translation_status_reviewerId_idx" ON "Translation"("status", "reviewerId");

-- CreateIndex
CREATE INDEX "Translation_priority_updatedAt_idx" ON "Translation"("priority", "updatedAt");

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
