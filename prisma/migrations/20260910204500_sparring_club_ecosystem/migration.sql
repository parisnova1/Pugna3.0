-- CreateEnum
CREATE TYPE "SparringAccessMode" AS ENUM ('INVITE', 'OPEN_TO_CLUBS', 'OPEN');

-- CreateEnum
CREATE TYPE "SparringClubStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SparringNominationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_CLUB_INVITED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_CLUB_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_CLUB_RESPONDED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_NOMINATED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_NOMINATION_RESPONDED';

-- AlterTable
ALTER TABLE "SparringSession" ADD COLUMN     "accessMode" "SparringAccessMode" NOT NULL DEFAULT 'OPEN_TO_CLUBS';

-- CreateTable
CREATE TABLE "SparringClubInvite" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "invitedClubId" TEXT NOT NULL,
    "status" "SparringClubStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringClubInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringClubRequest" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "requestingClubId" TEXT NOT NULL,
    "status" "SparringClubStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringClubRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringNomination" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nominatingClubId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "weightGroupId" TEXT,
    "status" "SparringNominationStatus" NOT NULL DEFAULT 'PENDING',
    "nominatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringNomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparringClubInvite_sessionId_invitedClubId_key" ON "SparringClubInvite"("sessionId", "invitedClubId");

-- CreateIndex
CREATE UNIQUE INDEX "SparringClubRequest_sessionId_requestingClubId_key" ON "SparringClubRequest"("sessionId", "requestingClubId");

-- CreateIndex
CREATE UNIQUE INDEX "SparringNomination_sessionId_fighterId_key" ON "SparringNomination"("sessionId", "fighterId");

-- AddForeignKey
ALTER TABLE "SparringClubInvite" ADD CONSTRAINT "SparringClubInvite_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringClubInvite" ADD CONSTRAINT "SparringClubInvite_invitedClubId_fkey" FOREIGN KEY ("invitedClubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringClubRequest" ADD CONSTRAINT "SparringClubRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringClubRequest" ADD CONSTRAINT "SparringClubRequest_requestingClubId_fkey" FOREIGN KEY ("requestingClubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringNomination" ADD CONSTRAINT "SparringNomination_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SparringSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringNomination" ADD CONSTRAINT "SparringNomination_nominatingClubId_fkey" FOREIGN KEY ("nominatingClubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringNomination" ADD CONSTRAINT "SparringNomination_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "FighterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringNomination" ADD CONSTRAINT "SparringNomination_weightGroupId_fkey" FOREIGN KEY ("weightGroupId") REFERENCES "SparringWeightGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every session that already exists at migration time was created
-- under the old any-fighter-self-joins model, so it must stay Open, not
-- silently become Open-to-clubs with participants that never went through a
-- club-level gate. New inserts keep the column default of OPEN_TO_CLUBS.
UPDATE "SparringSession" SET "accessMode" = 'OPEN';
