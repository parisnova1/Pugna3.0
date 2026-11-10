-- CreateEnum
CREATE TYPE "WaitlistRole" AS ENUM ('FAN', 'COACH', 'FIGHTER', 'ORGANIZER');

-- CreateTable
CREATE TABLE "FightOfDayVote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 1,
    "boutId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FightOfDayVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "WaitlistRole" NOT NULL DEFAULT 'FAN',
    "clubName" TEXT,
    "city" TEXT,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'site',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FightOfDayVote_eventId_day_boutId_idx" ON "FightOfDayVote"("eventId", "day", "boutId");

-- CreateIndex
CREATE UNIQUE INDEX "FightOfDayVote_eventId_day_voterKey_key" ON "FightOfDayVote"("eventId", "day", "voterKey");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSignup_email_key" ON "WaitlistSignup"("email");

-- CreateIndex
CREATE INDEX "WaitlistSignup_source_idx" ON "WaitlistSignup"("source");

-- AddForeignKey
ALTER TABLE "FightOfDayVote" ADD CONSTRAINT "FightOfDayVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FightOfDayVote" ADD CONSTRAINT "FightOfDayVote_boutId_fkey" FOREIGN KEY ("boutId") REFERENCES "Bout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
