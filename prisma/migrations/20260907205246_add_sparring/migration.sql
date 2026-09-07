-- CreateEnum
CREATE TYPE "SparringPostStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "SparringRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'SPARRING_DECLINED';

-- CreateTable
CREATE TABLE "SparringPost" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "gym" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightWindow" TEXT NOT NULL,
    "spots" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "status" "SparringPostStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SparringRequest" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "requestingClubId" TEXT NOT NULL,
    "status" "SparringRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SparringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SparringRequest_postId_requestingClubId_key" ON "SparringRequest"("postId", "requestingClubId");

-- AddForeignKey
ALTER TABLE "SparringPost" ADD CONSTRAINT "SparringPost_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringRequest" ADD CONSTRAINT "SparringRequest_postId_fkey" FOREIGN KEY ("postId") REFERENCES "SparringPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SparringRequest" ADD CONSTRAINT "SparringRequest_requestingClubId_fkey" FOREIGN KEY ("requestingClubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
