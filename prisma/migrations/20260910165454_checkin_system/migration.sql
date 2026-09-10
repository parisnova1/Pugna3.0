-- CreateEnum
CREATE TYPE "CheckInAttachedType" AS ENUM ('EVENT', 'SPARRING_SESSION');

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('CHECKED_IN', 'NO_SHOW', 'LATE');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CHECKIN_OPEN';

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "attachedType" "CheckInAttachedType" NOT NULL,
    "attachedId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_attachedType_attachedId_idx" ON "CheckIn"("attachedType", "attachedId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_attachedType_attachedId_fighterId_key" ON "CheckIn"("attachedType", "attachedId", "fighterId");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "FighterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
