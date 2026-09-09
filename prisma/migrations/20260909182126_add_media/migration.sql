-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('EVENT_COVER', 'EVENT_GALLERY', 'SPONSOR', 'BOUT_MEDIA', 'SPARRING_MEDIA');

-- CreateEnum
CREATE TYPE "MediaAttachedType" AS ENUM ('EVENT', 'BOUT', 'SPARRING_POST');

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "attachedType" "MediaAttachedType" NOT NULL,
    "attachedId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_attachedType_attachedId_idx" ON "Media"("attachedType", "attachedId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
