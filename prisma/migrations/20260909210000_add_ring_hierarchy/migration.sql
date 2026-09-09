-- CreateTable: Ring
CREATE TABLE "Ring" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT,
    "onBreak" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ring_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ring_eventId_number_key" ON "Ring"("eventId", "number");

ALTER TABLE "Ring" ADD CONSTRAINT "Ring_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one Ring row per ring number actually in use for each event
-- (covers ringCount, and defensively any higher bout.ring value that predates it).
INSERT INTO "Ring" ("id", "eventId", "number", "name", "onBreak", "createdAt")
SELECT gen_random_uuid()::text, e."id", n, NULL, false, now()
FROM "Event" e
CROSS JOIN LATERAL generate_series(
    1,
    GREATEST(e."ringCount", (SELECT COALESCE(MAX(b."ring"), 1) FROM "Bout" b WHERE b."eventId" = e."id"))
) AS n;

-- AlterTable: add Bout.ringId nullable first so it can be backfilled
ALTER TABLE "Bout" ADD COLUMN "ringId" TEXT;

UPDATE "Bout" b
SET "ringId" = r."id"
FROM "Ring" r
WHERE r."eventId" = b."eventId" AND r."number" = b."ring";

-- Every bout now has a matching Ring row (backfill above created rings for
-- every ring number in use) — safe to make the column required.
ALTER TABLE "Bout" ALTER COLUMN "ringId" SET NOT NULL;
ALTER TABLE "Bout" ADD CONSTRAINT "Bout_ringId_fkey" FOREIGN KEY ("ringId") REFERENCES "Ring"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bout" DROP COLUMN "ring";
