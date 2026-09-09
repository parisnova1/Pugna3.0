import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify, generateEventCode } from "../lib/slug";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function upsertUser(email: string, name: string) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, passwordHash },
  });
}

async function main() {
  console.log("Seeding the north-star demo path...");

  const organizer = await upsertUser("organizer@pugna.local", "Organizer Olsen");
  await prisma.organizerProfile.upsert({
    where: { userId: organizer.id },
    update: {},
    create: { userId: organizer.id, displayName: "Organizer Olsen" },
  });

  const clubAdmin = await upsertUser("club@pugna.local", "Club Casey");
  const fan = await upsertUser("fan@pugna.local", "Fan Frankie");

  const club =
    (await prisma.club.findFirst({ where: { name: "Golden Gate Combat Club" } })) ??
    (await prisma.club.create({ data: { name: "Golden Gate Combat Club", city: "San Francisco" } }));

  await prisma.clubAdmin.upsert({
    where: { clubId_userId: { clubId: club.id, userId: clubAdmin.id } },
    update: {},
    create: { clubId: club.id, userId: clubAdmin.id },
  });

  const fighterSeeds = [
    { email: "morales@pugna.local", name: "Alex Morales", weight: "75kg" },
    { email: "lee@pugna.local", name: "Jordan Lee", weight: "75kg" },
    { email: "rivera@pugna.local", name: "Sam Rivera", weight: "68kg" },
    { email: "kim@pugna.local", name: "Casey Kim", weight: "68kg" },
  ];

  const fighters = [];
  for (const f of fighterSeeds) {
    const user = await upsertUser(f.email, f.name);
    const profile = await prisma.fighterProfile.upsert({
      where: { userId: user.id },
      update: { clubId: club.id, weightClass: f.weight, displayName: f.name },
      create: { userId: user.id, clubId: club.id, weightClass: f.weight, displayName: f.name },
    });
    fighters.push(profile);
  }
  const [morales, lee, rivera, kim] = fighters as [
    (typeof fighters)[number],
    (typeof fighters)[number],
    (typeof fighters)[number],
    (typeof fighters)[number],
  ];

  // Morales is both a Boxer and a Club admin — a real dual-context account for
  // exercising the Account hub's "more than one card" case.
  const moralesUser = await prisma.user.findUnique({ where: { email: "morales@pugna.local" } });
  if (moralesUser) {
    await prisma.clubAdmin.upsert({
      where: { clubId_userId: { clubId: club.id, userId: moralesUser.id } },
      update: {},
      create: { clubId: club.id, userId: moralesUser.id },
    });
  }

  const eventDate = new Date();
  eventDate.setHours(19, 0, 0, 0);

  let event = await prisma.event.findFirst({ where: { name: "Golden Gate Fight Night" } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: "Golden Gate Fight Night",
        date: eventDate,
        startTime: eventDate,
        city: "San Francisco",
        venue: "Bayview Arena",
        organizingClubId: club.id,
        createdByUserId: organizer.id,
        status: "DRAFT",
        hostMembers: { create: [{ userId: organizer.id }] },
      },
    });
  }

  // Ensure a real 2-ring demo path — bump ringCount and name the rings
  // regardless of whether the event pre-dates the Ring model (Phase 2 backfill
  // would have given it a single default "Ring 1" row).
  await prisma.event.update({ where: { id: event.id }, data: { ringCount: 2 } });
  const mainRing = await prisma.ring.upsert({
    where: { eventId_number: { eventId: event.id, number: 1 } },
    update: { name: "Main Ring" },
    create: { eventId: event.id, number: 1, name: "Main Ring" },
  });
  const youthRing = await prisma.ring.upsert({
    where: { eventId_number: { eventId: event.id, number: 2 } },
    update: { name: "Youth Ring" },
    create: { eventId: event.id, number: 2, name: "Youth Ring" },
  });

  for (const [fighter, weight] of [
    [morales, "75kg"],
    [lee, "75kg"],
    [rivera, "68kg"],
    [kim, "68kg"],
  ] as const) {
    const existing = await prisma.nomination.findFirst({ where: { eventId: event.id, fighterId: fighter.id } });
    if (!existing) {
      await prisma.nomination.create({
        data: { eventId: event.id, clubId: club.id, fighterId: fighter.id, weightClass: weight, status: "CONFIRMED" },
      });
    }
  }

  const boutCount = await prisma.bout.count({ where: { eventId: event.id } });
  if (boutCount === 0) {
    await prisma.bout.create({
      data: {
        eventId: event.id,
        number: 1,
        weightClass: "75kg",
        ringId: mainRing.id,
        fighterAId: morales.id,
        fighterBId: lee.id,
        status: "READY",
      },
    });
    await prisma.bout.create({
      data: {
        eventId: event.id,
        number: 2,
        weightClass: "68kg",
        ringId: youthRing.id,
        fighterAId: rivera.id,
        fighterBId: kim.id,
        status: "READY",
      },
    });
  } else {
    // Re-splits a pre-Phase-2 seed run's bouts across the two named rings.
    await prisma.bout.updateMany({ where: { eventId: event.id, number: 1 }, data: { ringId: mainRing.id } });
    await prisma.bout.updateMany({ where: { eventId: event.id, number: 2 }, data: { ringId: youthRing.id } });
  }

  if (event.status === "DRAFT") {
    const slug = slugify(event.name, event.date);
    const code = generateEventCode();
    event = await prisma.event.update({ where: { id: event.id }, data: { status: "PUBLISHED", slug, code } });
  }

  await prisma.follow.upsert({
    where: { userId_eventId: { userId: fan.id, eventId: event.id } },
    update: {},
    create: { userId: fan.id, eventId: event.id },
  });

  console.log("\nSeed complete. Demo accounts (password: %s):", PASSWORD);
  console.log("  organizer@pugna.local  (Organizer context, hosts the event, runs the live console)");
  console.log("  club@pugna.local       (Club context, admins Golden Gate Combat Club)");
  console.log("  morales@pugna.local    (Boxer + Club admin — dual-context demo account)");
  console.log("  lee/rivera/kim@pugna.local  (Boxer context, nominated + confirmed)");
  console.log("  fan@pugna.local        (viewer, already follows the event)");
  console.log(`\nEvent has 2 rings: Main Ring (Bout 1) and Youth Ring (Bout 2).`);
  console.log(`Public tournament overview: /e/${event.slug}`);
  console.log(`Share link:                 /go/${event.code}`);
  console.log(`Live console (multi-ring):  /host/events/${event.id}/live (sign in as organizer@pugna.local)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
