-- CreateEnum
CREATE TYPE "RoundPhase" AS ENUM ('ROUND', 'REST');

-- AlterTable
ALTER TABLE "Bout" ADD COLUMN     "currentRound" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phaseEndsAt" TIMESTAMP(3),
ADD COLUMN     "restDurationSec" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "roundDurationSec" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "roundPhase" "RoundPhase",
ADD COLUMN     "totalRounds" INTEGER;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "intermissionUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Ring" ADD COLUMN     "breakUntil" TIMESTAMP(3);
