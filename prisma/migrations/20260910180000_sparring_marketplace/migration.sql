-- CreateEnum
CREATE TYPE "SparringSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SparringParticipantStatus" AS ENUM ('REQUESTED', 'INVITED', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "SparringMatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED');

-- AlterEnum
BEGIN;
CREATE TYPE "MediaAttachedType_new" AS ENUM ('EVENT', 'BOUT', 'SPARRING_SESSION');
ALTER TABLE "Media" ALTER COLUMN "attachedType" TYPE "MediaAttachedType_new" USING ("attachedType"::text::"MediaAttachedType_new");
ALTER TYPE "MediaAttachedType" RENAME TO "MediaAttachedType_old";
ALTER TYPE "MediaAttachedType_new" RENAME TO "MediaAttachedType";
DROP TYPE "public"."MediaAttachedType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_MATCHED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_INVITED';

-- DropForeignKey
ALTER TABLE "public"."SparringPost" DROP CONSTRAINT "SparringPost_clubId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SparringRequest" DROP CONSTRAINT "SparringRequest_postId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SparringRequest" DROP CONSTRAINT "SparringRequest_requestingClubId_fkey";

-- DropTable
DROP TABLE "public"."SparringPost";

-- DropTable
DROP TABLE "public"."SparringRequest";

-- DropEnum
DROP TYPE "public"."SparringPostStatus";

-- DropEnum
DROP TYPE "public"."SparringRequestStatus";

-- CreateTable
CREATE TABLE "SparringSession" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "sport" TEXT NOT NULL DEFAULT 'Boxing',
    "gym" TEXT NOT NULL,
    "city" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "rulesText" TEXT,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "sex" TEXT,
    "experienceLevel" TEXT,
    "status" "SparringSessionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparringSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringWeightGroup" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SparringWeightGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "weightGroupId" TEXT,
    "status" "SparringParticipantStatus" NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SparringParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringMatch" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "status" "SparringMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparringParticipant_sessionId_fighterId_key" ON "SparringParticipant"("sessionId", "fighterId");

-- AddForeignKey
ALTER TABLE "SparringSession" ADD CONSTRAINT "SparringSession_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringWeightGroup" ADD CONSTRAINT "SparringWeightGroup_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringParticipant" ADD CONSTRAINT "SparringParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringParticipant" ADD CONSTRAINT "SparringParticipant_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "FighterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringParticipant" ADD CONSTRAINT "SparringParticipant_weightGroupId_fkey" FOREIGN KEY ("weightGroupId") REFERENCES "SparringWeightGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringMatch" ADD CONSTRAINT "SparringMatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringMatch" ADD CONSTRAINT "SparringMatch_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "SparringParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringMatch" ADD CONSTRAINT "SparringMatch_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "SparringParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

