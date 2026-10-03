import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/rbac";
import { fakeDb } from "./helpers/fake-prisma";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-prisma")).fakeDb.prisma }));
vi.mock("@/lib/actor", () => ({ getActor: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/scan-log", () => ({ logScan: vi.fn() }));
vi.mock("@/lib/recipients", () => ({
  getFollowerUserIds: vi.fn(async () => []),
  getBoutFighterUserIds: vi.fn(async () => []),
  clubAdminUserIds: vi.fn(async () => []),
}));

import { getActor } from "@/lib/actor";
import { notify } from "@/lib/actions/notify";
import { nominateFighter } from "@/lib/actions/request";
import { requestClubForEvent } from "@/lib/actions/clubEvent";
import { setCheckInStatus } from "@/lib/actions/checkin";
import { kindAllowedFor } from "@/lib/security/upload";
import { isEntryOpen } from "@/lib/event-status";

const form = (fields: Record<string, string> = {}) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

const adminOf = (clubId: string): NonNullable<Actor> => ({
  userId: `admin-${clubId}`,
  isBoxer: false,
  clubIds: [clubId],
  isOrganizer: false,
  emailVerified: true,
  hostEventIds: [],
  hostRoles: {},
  clubRoles: { [clubId]: "CLUB_ADMIN" },
});
const ownerOfA: NonNullable<Actor> = {
  userId: "host",
  isBoxer: false,
  clubIds: [],
  isOrganizer: true,
  emailVerified: true,
  hostEventIds: ["A"],
  hostRoles: { A: { role: "EVENT_OWNER", ringIds: [] } },
  clubRoles: {},
};

function seed() {
  fakeDb.reset();
  const t = fakeDb.tables;
  t.event.push(
    { id: "A", name: "Fight Night", slug: "fight-night", status: "PUBLISHED" },
    { id: "DONE", name: "Old Night", slug: "old", status: "FINISHED" },
    { id: "DRAFT", name: "Secret Night", slug: null, status: "DRAFT" },
  );
  t.club.push({ id: "C1", name: "Club One" }, { id: "C2", name: "Club Two" });
  t.clubEventParticipation.push({ id: "p1", eventId: "A", clubId: "C1" }, { id: "p2", eventId: "DONE", clubId: "C1" }, { id: "p3", eventId: "A", clubId: "C2" });
  t.fighterProfile.push(
    { id: "f1", userId: "u-f1", displayName: "One", clubId: "C1" },
    { id: "f2", userId: "u-f2", displayName: "Two", clubId: "C2" },
  );
}

describe("club nominations must relate fighter, club and event", () => {
  beforeEach(() => {
    seed();
    vi.mocked(getActor).mockResolvedValue(adminOf("C1"));
    vi.mocked(notify).mockClear();
  });
  const nominate = (fields: Record<string, string>) => nominateFighter(form({ clubId: "C1", eventId: "A", fighterId: "f1", weightClass: "60kg", ...fields }));

  it("accepts a boxer from the club's own roster into an event the club is part of", async () => {
    expect(await nominate({})).toEqual({ ok: true });
    expect(fakeDb.tables.nomination).toMatchObject([{ eventId: "A", clubId: "C1", fighterId: "f1", status: "PENDING" }]);
    expect(notify).toHaveBeenCalledWith("u-f1", "NOMINATED", expect.stringContaining("Fight Night"), "/you/noms");
  });

  it("refuses another club's boxer (no nomination, no notification)", async () => {
    expect(await nominate({ fighterId: "f2" })).toMatchObject({ ok: false, code: "VALIDATION_BLOCKED" });
    expect(fakeDb.tables.nomination).toEqual([]);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses an event the club isn't participating in", async () => {
    seed();
    fakeDb.tables.clubEventParticipation.length = 0;
    expect(await nominate({})).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(fakeDb.tables.nomination).toEqual([]);
  });

  it("refuses events that are finished or don't exist", async () => {
    expect(await nominate({ eventId: "DONE" })).toMatchObject({ ok: false });
    expect(await nominate({ eventId: "nope" })).toMatchObject({ ok: false });
    expect(fakeDb.tables.nomination).toEqual([]);
  });

  it("won't nominate the same boxer twice, but allows a retry after a decline", async () => {
    await nominate({});
    expect(await nominate({})).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(fakeDb.tables.nomination).toHaveLength(1);
    fakeDb.tables.nomination[0]!.status = "DECLINED";
    expect(await nominate({})).toEqual({ ok: true });
    expect(fakeDb.tables.nomination).toHaveLength(2);
  });

  it("rejects an absurd weight class", async () => {
    expect(await nominate({ weightClass: "x".repeat(50) })).toMatchObject({ ok: false });
  });

  it("an admin of a different club can't nominate on this club's behalf", async () => {
    vi.mocked(getActor).mockResolvedValue(adminOf("C2"));
    expect(await nominate({})).toMatchObject({ ok: false });
    expect(fakeDb.tables.nomination).toEqual([]);
  });
});

describe("requestClubForEvent only targets events that are public and not over", () => {
  beforeEach(() => {
    seed();
    vi.mocked(getActor).mockResolvedValue(adminOf("C1"));
  });
  const request = (eventId: string) => requestClubForEvent(eventId, "C1", form());

  it("works for a published event", async () => {
    expect(await request("A")).toEqual({ ok: true });
    expect(fakeDb.tables.clubEventRequest).toHaveLength(1);
  });

  it("refuses a draft (its existence isn't confirmed) and a finished event", async () => {
    expect(await request("DRAFT")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await request("DONE")).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(fakeDb.tables.clubEventRequest).toEqual([]);
  });
});

describe("setCheckInStatus only touches fighters who belong to the event", () => {
  beforeEach(() => {
    seed();
    fakeDb.tables.bout.push({ id: "b1", eventId: "A", fighterAId: "f1", fighterBId: "f2" });
    vi.mocked(getActor).mockResolvedValue(ownerOfA);
  });

  it("checks in a fighter on the card", async () => {
    expect(await setCheckInStatus("EVENT", "A", "f1", "CHECKED_IN")).toEqual({ ok: true });
    expect(fakeDb.tables.checkIn).toMatchObject([{ attachedId: "A", fighterId: "f1" }]);
  });

  it("refuses a fighter who isn't in this event", async () => {
    const result = await setCheckInStatus("EVENT", "A", "stranger", "CHECKED_IN");
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(fakeDb.tables.checkIn).toEqual([]);
  });
});

describe("upload targets", () => {
  it("only accepts media kinds that make sense for the target", () => {
    expect(kindAllowedFor("EVENT", "EVENT_COVER")).toBe(true);
    expect(kindAllowedFor("CLUB", "CLUB_COVER")).toBe(true);
    expect(kindAllowedFor("FIGHTER", "FIGHTER_AVATAR")).toBe(true);
    expect(kindAllowedFor("EVENT", "CLUB_COVER")).toBe(false);
    expect(kindAllowedFor("CLUB", "EVENT_COVER")).toBe(false);
    expect(kindAllowedFor("FIGHTER", "SPONSOR")).toBe(false);
    expect(kindAllowedFor("NOPE", "EVENT_COVER")).toBe(false);
  });
});

describe("entry window", () => {
  it("is open before an event runs and closed once it does", () => {
    for (const s of ["DRAFT", "READY", "PUBLISHED"]) expect(isEntryOpen(s)).toBe(true);
    for (const s of ["LIVE", "INTERMISSION", "FINISHED", "CANCELLED", "ARCHIVED"]) expect(isEntryOpen(s)).toBe(false);
  });
});
