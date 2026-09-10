-- CreateEnum
CREATE TYPE "ClubTier" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "tier" "ClubTier" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "FighterProfile" ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "experienceLevel" TEXT,
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "stance" TEXT,
ADD COLUMN     "style" TEXT;
