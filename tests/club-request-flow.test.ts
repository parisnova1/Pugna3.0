import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/lib/rbac";
import { fakeDb } from "./helpers/fake-prisma";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./helpers/fake-prisma")).fakeDb.prisma }));
vi.mock("@/lib/actor", () => ({ getActor: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/actions/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/lib/recipients", () => ({
  getFollowerUserIds: vi.fn(async () => []),
  getBoutFighterUserIds: vi.fn(async () => []),
  clubAdminUserIds: vi.fn(async () => ["admin-1"]),
}));

import { getActor } from "@/lib/actor";
import { notifyMany } from "@/lib/actions/notify";
import { inviteClubToEvent, respondToClubEventInvite } from "@/lib/actions/clubEvent";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");
const form = (message = "") => {
  const fd = new FormData();
  if (message) fd.set("message", message);
  return fd;
};

const organizer: NonNullable<Actor> = {
  userId: "organizer",
  isBoxer: false,
  clubIds: [],
  isOrganizer: true,
  emailVerified: true,
  hostEventIds: ["A"],
  hostRoles: { A: { role: "EVENT_OWNER", ringIds: [] } },
  clubRoles: {},
};
const clubAdmin: NonNullable<Actor> = {
  userId: "admin-1",
  isBoxer: false,
  clubIds: ["C1"],
  isOrganizer: false,
  emailVerified: true,
  hostEventIds: [],
  hostRoles: {},
  clubRoles: { C1: "CLUB_ADMIN" },
};
const otherClubAdmin: NonNullable<Actor> = { ...clubAdmin, userId: "admin-2", clubIds: ["C2"], clubRoles: { C2: "CLUB_ADMIN" } };

beforeEach(() => {
  fakeDb.reset();
  fakeDb.tables.event.push({ id: "A", name: "Franken Fight Night", slug: "franken", status: "PUBLISHED" });
  fakeDb.tables.club.push({ id: "C1", name: "Club One" }, { id: "C2", name: "Club Two" });
  fakeDb.tables.eventHostMember.push({ id: "m1", eventId: "A", userId: "organizer" });
  vi.mocked(notifyMany).mockClear();
});

/** The same queries the three screens run, so the test follows what each one would show. */
const hostEntriesPageShows = () => ({
  invites: fakeDb.tables.clubEventInvite.filter((i) => i.eventId === "A"),
  participating: fakeDb.tables.clubEventParticipation.filter((p) => p.eventId === "A"),
});
const clubRequestsPageShows = (clubId: string) =>
  fakeDb.tables.clubEventInvite.filter((i) => i.invitedClubId === clubId && i.status === "PENDING");
const publicEventPageShows = () => fakeDb.tables.clubEventParticipation.filter((p) => p.eventId === "A").map((p) => p.clubId);

describe("Organizer -> Request a club -> Club Requests -> Accept -> Participating Clubs -> public event", () => {
  it("carries one invitation through every screen and ends with the same state everywhere", async () => {
    // Organizer invites Club One from the host Entries form.
    vi.mocked(getActor).mockResolvedValue(organizer);
    expect(await inviteClubToEvent("A", "C1", form("E2E regression check"))).toEqual({ ok: true });

    // The host sees it pending; the club sees it under Event Invitations; the event has no participants yet.
    expect(hostEntriesPageShows().invites).toMatchObject([{ invitedClubId: "C1", status: "PENDING", message: "E2E regression check" }]);
    expect(clubRequestsPageShows("C1")).toHaveLength(1);
    expect(publicEventPageShows()).toEqual([]);

    // The club's admins are told, and are sent to the Requests inbox.
    expect(notifyMany).toHaveBeenCalledWith(["admin-1"], "CLUB_EVENT_INVITED", expect.stringContaining("Club One"), "/club/requests");

    // Club One accepts.
    vi.mocked(getActor).mockResolvedValue(clubAdmin);
    const inviteId = clubRequestsPageShows("C1")[0]!.id as string;
    expect(await respondToClubEventInvite(inviteId, true)).toEqual({ ok: true });

    // Every screen now agrees.
    expect(hostEntriesPageShows().invites[0]!.status).toBe("ACCEPTED");
    expect(hostEntriesPageShows().participating).toMatchObject([{ clubId: "C1" }]);
    expect(clubRequestsPageShows("C1")).toEqual([]);
    expect(publicEventPageShows()).toEqual(["C1"]);

    // The organizer hears back, on the page where the club now appears.
    expect(notifyMany).toHaveBeenLastCalledWith(
      ["organizer"],
      "CLUB_EVENT_REQUEST_RESPONDED",
      expect.stringContaining("accepted"),
      "/host/events/A/entries",
    );
  });

  it("a declined invitation never makes the club a participant", async () => {
    vi.mocked(getActor).mockResolvedValue(organizer);
    await inviteClubToEvent("A", "C1", form());
    vi.mocked(getActor).mockResolvedValue(clubAdmin);
    await respondToClubEventInvite(clubRequestsPageShows("C1")[0]!.id as string, false);
    expect(hostEntriesPageShows().invites[0]!.status).toBe("DECLINED");
    expect(publicEventPageShows()).toEqual([]);
  });

  it("an invitation can't be answered twice", async () => {
    vi.mocked(getActor).mockResolvedValue(organizer);
    await inviteClubToEvent("A", "C1", form());
    vi.mocked(getActor).mockResolvedValue(clubAdmin);
    const id = clubRequestsPageShows("C1")[0]!.id as string;
    await respondToClubEventInvite(id, true);
    expect(await respondToClubEventInvite(id, false)).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(publicEventPageShows()).toEqual(["C1"]);
  });

  it("the same club can't be invited to the same event twice", async () => {
    vi.mocked(getActor).mockResolvedValue(organizer);
    await inviteClubToEvent("A", "C1", form());
    expect(await inviteClubToEvent("A", "C1", form())).toMatchObject({ ok: false, code: "CONFLICT" });
    expect(hostEntriesPageShows().invites).toHaveLength(1);
  });

  it("only that club's admins can answer, and only an owner or admin of the event can invite", async () => {
    vi.mocked(getActor).mockResolvedValue({ ...organizer, hostRoles: { A: { role: "RING_OFFICIAL", ringIds: [] } } });
    expect(await inviteClubToEvent("A", "C1", form())).toMatchObject({ ok: false });
    expect(hostEntriesPageShows().invites).toEqual([]);

    vi.mocked(getActor).mockResolvedValue(organizer);
    await inviteClubToEvent("A", "C1", form());
    const id = clubRequestsPageShows("C1")[0]!.id as string;

    vi.mocked(getActor).mockResolvedValue(otherClubAdmin);
    expect(await respondToClubEventInvite(id, true)).toMatchObject({ ok: false });
    vi.mocked(getActor).mockResolvedValue(null);
    expect(await respondToClubEventInvite(id, true)).toMatchObject({ ok: false });
    expect(publicEventPageShows()).toEqual([]);
  });
});

describe("one canonical club <-> event system (guards against the regression returning)", () => {
  const sourceFiles = (dir: string, out: string[] = []): string[] => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(rel, out);
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };
  const all = ["app", "components", "lib"].flatMap((d) => sourceFiles(d));

  it("nothing writes or reads the legacy EventRequest table", () => {
    const offenders = all.filter((f) => /prisma\.eventRequest\b/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the old requestClub action is not imported anywhere", () => {
    const offenders = all.filter((f) => /import[^;]*\brequestClub\b[^;]*from/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it("the host form sends invitations through inviteClubToEvent", () => {
    const page = read("app/(shell)/host/events/[id]/entries/page.tsx");
    expect(page).toMatch(/import \{ inviteClubToEvent \} from "@\/lib\/actions\/clubEvent"/);
    expect(page).toMatch(/inviteClubToEvent\(/);
  });

  it("the host, club and public screens all read the same ClubEventInvite / Participation tables", () => {
    expect(read("app/(shell)/host/events/[id]/entries/page.tsx")).toMatch(/clubEventInvite\.findMany/);
    expect(read("app/(shell)/host/events/[id]/entries/page.tsx")).toMatch(/clubEventParticipation\.findMany/);
    expect(read("app/(shell)/club/requests/page.tsx")).toMatch(/clubEventInvite\.findMany/);
    expect(read("app/e/[slug]/page.tsx")).toMatch(/clubEventParticipation\.findMany/);
  });
});
