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
import { notifyMany } from "@/lib/actions/notify";
import { setBoutSchedule } from "@/lib/actions/event";
import { isReschedulable, rescheduleMessage, scheduleChanged } from "@/lib/schedule";
import { isActiveEventStatus, isPublishedEventStatus } from "@/lib/event-status";

const T1 = new Date("2026-12-01T10:00");
const T2 = new Date("2026-12-01T11:30");

describe("schedule helpers", () => {
  it("detects a start time that really moved", () => {
    expect(scheduleChanged(null, T1)).toBe(true);
    expect(scheduleChanged(T1, null)).toBe(true);
    expect(scheduleChanged(T1, T2)).toBe(true);
    expect(scheduleChanged(T1, new Date(T1))).toBe(false);
    expect(scheduleChanged(null, null)).toBe(false);
  });

  it("ignores bouts that have already run or been called off", () => {
    for (const s of ["FINAL", "SCRATCHED", "NO_SHOW"]) expect(isReschedulable(s)).toBe(false);
    for (const s of ["TBD", "CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"]) expect(isReschedulable(s)).toBe(true);
  });

  it("words the message for the audience", () => {
    expect(rescheduleMessage({ audience: "fighter", eventName: "Fight Night", when: T2 })).toMatch(/^Your bout at Fight Night has been rescheduled to Dec 1, 2026/);
    expect(rescheduleMessage({ audience: "watcher", eventName: "Fight Night", when: T2, matchup: "A vs B" })).toMatch(/^A vs B at Fight Night/);
    expect(rescheduleMessage({ audience: "fighter", eventName: "Fight Night", when: null })).toMatch(/no longer has a set time/);
  });
});

describe("event status", () => {
  it("one definition of published", () => {
    expect(["DRAFT", "READY"].map(isPublishedEventStatus)).toEqual([false, false]);
    for (const s of ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED", "CANCELLED", "ARCHIVED"]) expect(isPublishedEventStatus(s)).toBe(true);
  });

  it("only running events count as active for schedule changes", () => {
    for (const s of ["PUBLISHED", "LIVE", "INTERMISSION"]) expect(isActiveEventStatus(s)).toBe(true);
    for (const s of ["DRAFT", "READY", "FINISHED", "CANCELLED", "ARCHIVED"]) expect(isActiveEventStatus(s)).toBe(false);
  });
});

const owner: NonNullable<Actor> = {
  userId: "host",
  isBoxer: false,
  clubIds: [],
  isOrganizer: true,
  emailVerified: true,
  hostEventIds: ["A"],
  hostRoles: { A: { role: "EVENT_OWNER", ringIds: [] } },
  clubRoles: {},
};

const form = (time: string) => {
  const fd = new FormData();
  fd.set("scheduledTime", time);
  return fd;
};

function seed(opts: { eventStatus?: string; boutStatus?: string; scheduledTime?: Date | null } = {}) {
  fakeDb.reset();
  const t = fakeDb.tables;
  t.event.push({ id: "A", name: "Fight Night", slug: "fight-night", status: opts.eventStatus ?? "PUBLISHED" });
  t.bout.push({
    id: "b1",
    eventId: "A",
    status: opts.boutStatus ?? "READY",
    scheduledTime: opts.scheduledTime === undefined ? T1 : opts.scheduledTime,
    fighterA: { userId: "u-red", displayName: "Red" },
    fighterB: { userId: "u-blue", displayName: "Blue" },
    event: t.event[0],
  });
  t.savedBout.push({ id: "s1", boutId: "b1", userId: "fan" }, { id: "s2", boutId: "b1", userId: "u-red" });
}

describe("SCHEDULE_CHANGED notifications", () => {
  beforeEach(() => {
    vi.mocked(getActor).mockResolvedValue(owner);
    vi.mocked(notifyMany).mockClear();
  });

  const formatFor = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  it("tells both fighters, and savers who aren't fighters, when a live bout moves", async () => {
    seed();
    expect(await setBoutSchedule("b1", "A", form(formatFor(T2)))).toEqual({ ok: true });
    const calls = vi.mocked(notifyMany).mock.calls;
    expect(calls).toHaveLength(2);
    const [fighters, watchers] = calls;
    expect(fighters![0].sort()).toEqual(["u-blue", "u-red"]);
    expect(fighters![1]).toBe("SCHEDULE_CHANGED");
    expect(fighters![2]).toMatch(/^Your bout at Fight Night has been rescheduled/);
    // "u-red" saved the bout too but already heard as a fighter -- only "fan" is a watcher.
    expect(watchers![0]).toEqual(["fan"]);
    expect(watchers![2]).toMatch(/^Red vs Blue at Fight Night/);
    expect(fighters![3]).toBe("/e/fight-night/bout/b1");
    expect(fakeDb.tables.bout[0]!.scheduledTime).toEqual(T2);
  });

  it("stays quiet when the time didn't actually change", async () => {
    seed();
    await setBoutSchedule("b1", "A", form(formatFor(T1)));
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("stays quiet while the event is still being built", async () => {
    for (const eventStatus of ["DRAFT", "READY"]) {
      seed({ eventStatus });
      await setBoutSchedule("b1", "A", form(formatFor(T2)));
    }
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("stays quiet for a bout that has already finished", async () => {
    seed({ boutStatus: "FINAL" });
    await setBoutSchedule("b1", "A", form(formatFor(T2)));
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("stays quiet once the event is over", async () => {
    seed({ eventStatus: "FINISHED" });
    await setBoutSchedule("b1", "A", form(formatFor(T2)));
    expect(notifyMany).not.toHaveBeenCalled();
  });

  it("says so when a time is removed", async () => {
    seed();
    await setBoutSchedule("b1", "A", form(""));
    expect(vi.mocked(notifyMany).mock.calls[0]![2]).toMatch(/no longer has a set time/);
  });
});
