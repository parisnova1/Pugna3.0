import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/rbac";
import { fakeDb } from "./helpers/fake-prisma";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-prisma")).fakeDb.prisma }));
vi.mock("@/lib/actor", () => ({ getActor: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("@/lib/actions/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/recipients", () => ({
  getFollowerUserIds: vi.fn(async () => []),
  getBoutFighterUserIds: vi.fn(async () => []),
  clubAdminUserIds: vi.fn(async () => []),
}));
vi.mock("@/lib/geocode", () => ({ geocodeVenue: vi.fn(async () => null), geocodeAddress: vi.fn(async () => null) }));

import { getActor } from "@/lib/actor";
import * as live from "@/lib/actions/live";
import * as eventActions from "@/lib/actions/event";
import * as crowd from "@/lib/actions/crowd";
import * as sparring from "@/lib/actions/sparring";
import * as sparringClub from "@/lib/actions/sparringClub";

const form = (fields: Record<string, string> = {}) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
  return fd;
};

/** Owns event A only -- the attacker in every test below. */
const ownerOfA: NonNullable<Actor> = {
  userId: "attacker",
  isBoxer: false,
  clubIds: [],
  isOrganizer: true,
  emailVerified: true,
  hostEventIds: ["A"],
  hostRoles: { A: { role: "EVENT_OWNER", ringIds: [] } },
  clubRoles: {},
};

const adminOfClub1: NonNullable<Actor> = {
  userId: "club-admin",
  isBoxer: false,
  clubIds: ["C1"],
  isOrganizer: false,
  emailVerified: true,
  hostEventIds: [],
  hostRoles: {},
  clubRoles: { C1: "CLUB_OWNER" },
};

function seedEvents() {
  fakeDb.reset();
  const t = fakeDb.tables;
  t.event.push(
    { id: "A", name: "Event A", slug: "event-a", status: "LIVE" },
    { id: "B", name: "Event B", slug: "event-b", status: "LIVE" },
  );
  t.ring.push(
    { id: "ringA", eventId: "A", number: 1, name: "Ring A", onBreak: false },
    { id: "ringB", eventId: "B", number: 1, name: "Ring B", onBreak: false },
  );
  const fighter = (id: string) => ({ id, userId: `u-${id}`, displayName: id });
  t.bout.push(
    { id: "boutA", eventId: "A", ringId: "ringA", number: 1, status: "READY", weightClass: "60kg", fighterAId: "fa1", fighterBId: "fa2", fighterA: fighter("fa1"), fighterB: fighter("fa2"), ring: t.ring[0], event: t.event[0] },
    { id: "boutB", eventId: "B", ringId: "ringB", number: 1, status: "READY", weightClass: "60kg", fighterAId: "fb1", fighterBId: "fb2", fighterA: fighter("fb1"), fighterB: fighter("fb2"), ring: t.ring[1], event: t.event[1] },
  );
  // Extra bouts of event B in the exact states those actions require, so each attack
  // is refused (or not) purely on scoping rather than on an unrelated state check.
  t.bout.push(
    { id: "boutB2", eventId: "B", ringId: "ringB", number: 2, status: "IN_PROGRESS", roundPhase: "ROUND", totalRounds: 3, currentRound: 1, roundDurationSec: 120, restDurationSec: 60, weightClass: "60kg", fighterAId: "fb1", fighterBId: "fb2", fighterA: fighter("fb1"), fighterB: fighter("fb2"), ring: t.ring[1], event: t.event[1] },
    { id: "boutB3", eventId: "B", ringId: "ringB", number: 3, status: "CONFIRMED", weightClass: "60kg", fighterAId: "fb1", fighterBId: "fb2", fighterA: fighter("fb1"), fighterB: fighter("fb2"), ring: t.ring[1], event: t.event[1] },
  );
  t.crowdShout.push(
    { id: "shoutA", boutId: "boutA", userId: "x", text: "hi", hidden: false, bout: { eventId: "A" } },
    { id: "shoutB", boutId: "boutB", userId: "x", text: "hi", hidden: false, bout: { eventId: "B" } },
  );
}

describe("a host of event A cannot act on event B", () => {
  beforeEach(() => {
    seedEvents();
    vi.mocked(getActor).mockResolvedValue(ownerOfA);
  });

  const attacks: [string, () => Promise<{ ok: boolean; code?: string }>][] = [
    ["startBout", () => live.startBout("boutB", "A")],
    ["startRest", () => live.startRest("boutB2", "A")],
    ["startRound", () => live.startRound("boutB2", "A")],
    ["finishBout", () => live.finishBout("boutB2", "A", form({ winnerId: "fb1", method: "KO" }))],
    ["delayBout", () => live.delayBout("boutB", "A", form({ minutes: "10" }))],
    ["scratchBout", () => live.scratchBout("boutB", "A", form({ reason: "INJURY" }))],
    ["noShowBout", () => live.noShowBout("boutB", "A")],
    ["setRingBreak", () => live.setRingBreak("ringB", "A", true)],
    ["setBoutSchedule", () => eventActions.setBoutSchedule("boutB", "A", form({ scheduledTime: "2026-12-01T10:00" }))],
    ["setBoutStreamUrl", () => eventActions.setBoutStreamUrl("boutB", "A", form({ streamUrl: "https://evil.example/stream" }))],
    ["markBoutReady", () => eventActions.markBoutReady("boutB3", "A")],
    ["renameRing", () => eventActions.renameRing("ringB", "A", form({ name: "hijacked" }))],
    ["hideShout", () => crowd.hideShout("shoutB", "A")],
  ];

  it.each(attacks)("%s refuses a bout/ring/shout that belongs to another event and changes nothing", async (_name, attack) => {
    const before = fakeDb.snapshot();
    const result = await attack();
    expect(result.ok).toBe(false);
    expect(fakeDb.snapshot()).toBe(before);
    expect(fakeDb.mutations).toEqual([]);
  });

  it("createBout refuses a ring from another event", async () => {
    const before = fakeDb.snapshot();
    const result = await eventActions.createBout(form({ eventId: "A", ringId: "ringB", weightClass: "70kg" }));
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_BLOCKED" });
    expect(fakeDb.snapshot()).toBe(before);
  });

  describe("positive controls (the same actions still work on the event they own)", () => {
    it("renames its own ring", async () => {
      expect(await eventActions.renameRing("ringA", "A", form({ name: "Main" }))).toEqual({ ok: true });
      expect(fakeDb.tables.ring[0]!.name).toBe("Main");
      expect(fakeDb.tables.ring[1]!.name).toBe("Ring B");
    });

    it("hides a shout on its own event's bout", async () => {
      expect(await crowd.hideShout("shoutA", "A")).toEqual({ ok: true });
      expect(fakeDb.tables.crowdShout[0]!.hidden).toBe(true);
      expect(fakeDb.tables.crowdShout[1]!.hidden).toBe(false);
    });

    it("creates a bout on its own ring", async () => {
      expect(await eventActions.createBout(form({ eventId: "A", ringId: "ringA", weightClass: "70kg" }))).toEqual({ ok: true });
    });

    it("can still reach its own bout through the live gate", async () => {
      // Past the scope check the action proceeds to its own validation, so it must not report NOT_FOUND.
      const result = await live.noShowBout("boutA", "A");
      expect((result as { code?: string }).code).not.toBe("NOT_FOUND");
    });
  });

  it("an actor with no host role on any event is still refused outright", async () => {
    vi.mocked(getActor).mockResolvedValue({ ...ownerOfA, hostEventIds: [], hostRoles: {} });
    const result = await live.startBout("boutA", "A");
    expect(result.ok).toBe(false);
    expect(fakeDb.mutations).toEqual([]);
  });
});

describe("sparring ids are checked against the session", () => {
  beforeEach(() => {
    fakeDb.reset();
    const t = fakeDb.tables;
    t.sparringSession.push(
      { id: "S1", clubId: "C1", gym: "Gym One", status: "OPEN", accessMode: "OPEN" },
      { id: "S2", clubId: "C2", gym: "Gym Two", status: "OPEN", accessMode: "OPEN" },
    );
    t.sparringWeightGroup.push({ id: "wg1", sessionId: "S1" }, { id: "wg2", sessionId: "S2" });
    const fighter = (id: string) => ({ id, userId: `u-${id}`, displayName: id });
    t.sparringParticipant.push(
      { id: "p1", sessionId: "S1", fighterId: "f1", fighter: fighter("f1"), weightGroupId: "wg1" },
      { id: "p2", sessionId: "S1", fighterId: "f2", fighter: fighter("f2"), weightGroupId: "wg1" },
      { id: "foreign", sessionId: "S2", fighterId: "f3", fighter: fighter("f3"), weightGroupId: "wg2", session: t.sparringSession[1] },
    );
    t.sparringParticipant[0]!.session = t.sparringSession[0];
    vi.mocked(getActor).mockResolvedValue(adminOfClub1);
  });

  it("createMatch won't pair a participant from a different session", async () => {
    const before = fakeDb.snapshot();
    const result = await sparring.createMatch("S1", form({ participantAId: "p1", participantBId: "foreign" }));
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(fakeDb.snapshot()).toBe(before);
  });

  it("createMatch still pairs two participants of the session", async () => {
    const result = await sparring.createMatch("S1", form({ participantAId: "p1", participantBId: "p2" }));
    expect(result).toEqual({ ok: true });
    expect(fakeDb.tables.sparringMatch).toHaveLength(1);
  });

  it("moveWeightGroup refuses a weight group from another session", async () => {
    const before = fakeDb.snapshot();
    const result = await sparring.moveWeightGroup("p1", "wg2");
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_BLOCKED" });
    expect(fakeDb.snapshot()).toBe(before);
  });

  it("moveWeightGroup accepts one from the same session", async () => {
    expect(await sparring.moveWeightGroup("p1", "wg1")).toEqual({ ok: true });
  });

  it("registering can't target another session's weight group", async () => {
    vi.mocked(getActor).mockResolvedValue({ ...adminOfClub1, userId: "u-new", clubIds: [], clubRoles: {} });
    fakeDb.tables.fighterProfile.push({ id: "newbie", userId: "u-new", displayName: "Newbie", clubId: null });
    const before = fakeDb.snapshot();
    const result = await sparring.registerForSparring("S1", form({ weightGroupId: "wg2" }));
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_BLOCKED" });
    expect(fakeDb.snapshot()).toBe(before);
  });

  it("nominating can't target another session's weight group", async () => {
    fakeDb.tables.sparringSession[0]!.accessMode = "INVITE";
    fakeDb.tables.fighterProfile.push({ id: "f9", userId: "u-f9", displayName: "F9", clubId: "C1" });
    const before = fakeDb.snapshot();
    const result = await sparringClub.nominateFighter("S1", form({ clubId: "C1", fighterId: "f9", weightGroupId: "wg2" }));
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_BLOCKED" });
    expect(fakeDb.snapshot()).toBe(before);
  });
});
