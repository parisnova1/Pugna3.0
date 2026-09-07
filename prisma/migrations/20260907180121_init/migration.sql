-- CreateEnum
CREATE TYPE "Hat" AS ENUM ('FIGHTER', 'CLUB', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'LIVE', 'INTERMISSION', 'FINISHED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BoutStatus" AS ENUM ('DRAFT', 'TBD', 'CONFIRMED', 'READY', 'DELAYED', 'IN_PROGRESS', 'FINAL', 'SCRATCHED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETE', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NominationStatus" AS ENUM ('CREATED', 'PENDING', 'ACCEPTED', 'CONFIRMED', 'DECLINED', 'WITHDRAWN', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ScratchReason" AS ENUM ('INJURY', 'WITHDRAWAL', 'NO_OPPONENT', 'ORGANIZER_DECISION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "hats" "Hat"[] DEFAULT ARRAY[]::"Hat"[],
    "activeHat" "Hat",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubAdmin" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ClubAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FighterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "clubId" TEXT,
    "weightClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FighterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "venue" TEXT,
    "city" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3),
    "sport" TEXT NOT NULL DEFAULT 'Boxing',
    "description" TEXT,
    "streamUrl" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "organizingClubId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 1,
    "ringCount" INTEGER NOT NULL DEFAULT 1,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventHostMember" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "EventHostMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRequest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "requirements" JSONB NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomination" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fighterId" TEXT NOT NULL,
    "weightClass" TEXT NOT NULL,
    "status" "NominationStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bout" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "weightClass" TEXT NOT NULL,
    "ring" INTEGER NOT NULL DEFAULT 1,
    "day" INTEGER NOT NULL DEFAULT 1,
    "fighterAId" TEXT,
    "fighterBId" TEXT,
    "status" "BoutStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledTime" TIMESTAMP(3),
    "delayMinutes" INTEGER,
    "scratchReason" "ScratchReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "boutId" TEXT NOT NULL,
    "winnerId" TEXT,
    "loserId" TEXT,
    "method" TEXT NOT NULL,
    "round" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClubAdmin_clubId_userId_key" ON "ClubAdmin"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FighterProfile_userId_key" ON "FighterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventHostMember_eventId_userId_key" ON "EventHostMember"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRequest_eventId_clubId_key" ON "EventRequest"("eventId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "Bout_eventId_number_key" ON "Bout"("eventId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Result_boutId_key" ON "Result"("boutId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_eventId_key" ON "Follow"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubAdmin" ADD CONSTRAINT "ClubAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterProfile" ADD CONSTRAINT "FighterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterProfile" ADD CONSTRAINT "FighterProfile_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizingClubId_fkey" FOREIGN KEY ("organizingClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHostMember" ADD CONSTRAINT "EventHostMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHostMember" ADD CONSTRAINT "EventHostMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRequest" ADD CONSTRAINT "EventRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRequest" ADD CONSTRAINT "EventRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_fighterId_fkey" FOREIGN KEY ("fighterId") REFERENCES "FighterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bout" ADD CONSTRAINT "Bout_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bout" ADD CONSTRAINT "Bout_fighterAId_fkey" FOREIGN KEY ("fighterAId") REFERENCES "FighterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bout" ADD CONSTRAINT "Bout_fighterBId_fkey" FOREIGN KEY ("fighterBId") REFERENCES "FighterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_boutId_fkey" FOREIGN KEY ("boutId") REFERENCES "Bout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
