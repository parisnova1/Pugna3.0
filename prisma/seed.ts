import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify, generateEventCode } from "../lib/slug";

const prisma = new PrismaClient();

const PASSWORD = "password123";

async function upsertUser(email: string, name: string, hats: ("FIGHTER" | "CLUB" | "ORGANIZER")[], activeHat: "FIGHTER" | "CLUB" | "ORGANIZER" | null) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { hats, activeHat },
    create: { email, name, passwordHash, hats, activeHat },
  });
}

async function main() {
  console.log("Seeding the north-star demo path...");

  const organizer = await upsertUser("organizer@pugna.local", "Organizer Olsen", ["ORGANIZER"], "ORGANIZER");
  const clubAdmin = await upsertUser("club@pugna.local", "Club Casey", ["CLUB"], "CLUB");
  const fan = await upsertUser("fan@pugna.local", "Fan Frankie", [], null);

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
    const user = await upsertUser(f.email, f.name, ["FIGHTER"], "FIGHTER");
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
        fighterAId: rivera.id,
        fighterBId: kim.id,
        status: "READY",
      },
    });
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
  console.log("  organizer@pugna.local  (Organizer hat, hosts the event, runs the live console)");
  console.log("  club@pugna.local       (Club hat, admins Golden Gate Combat Club)");
  console.log("  morales@pugna.local … kim@pugna.local  (Fighter hat, nominated + confirmed)");
  console.log("  fan@pugna.local        (guest-equivalent account, already follows the event)");
  console.log(`\nPublic event card: /e/${event.slug}`);
  console.log(`Share link:         /go/${event.code}`);
  console.log(`Live console:       /host/events/${event.id}/live (sign in as organizer@pugna.local)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
