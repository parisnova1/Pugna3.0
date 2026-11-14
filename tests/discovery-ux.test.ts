import { describe, expect, it } from "vitest";
import type { EventStatus } from "@prisma/client";
import { displayStatus, eventEndsAt, hasEnded, pillWithEnded, spansDay, utcDayStart } from "@/lib/event-timing";
import { EMPTY_PREFS, parsePrefs, personalize, prefScore, serializePrefs, type Prefs } from "@/lib/prefs";
import { isTabActive, type TabId } from "@/lib/nav";
import { emailProblem, passwordProblem } from "@/lib/validation";
import { arrangeClubs } from "@/lib/clubs-list";
import { isPlausibleEmail } from "@/lib/security/password";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(iso);

describe("event freshness", () => {
  it("a one-day event is over once its day (plus a late-night margin) has passed", () => {
    const e = { date: day("2026-09-18"), dayCount: 1 };
    expect(hasEnded(e, at("2026-09-18T20:00:00Z"))).toBe(false); // that evening
    expect(hasEnded(e, at("2026-09-19T06:00:00Z"))).toBe(false); // still inside the 12h margin
    expect(hasEnded(e, at("2026-09-19T13:00:00Z"))).toBe(true);
  });

  it("a multi-day event stays current until its LAST day is over", () => {
    const e = { date: day("2026-09-10"), dayCount: 3 };
    expect(hasEnded(e, at("2026-09-12T10:00:00Z"))).toBe(false);
    expect(hasEnded(e, at("2026-09-13T13:00:00Z"))).toBe(true);
    expect(eventEndsAt(e).toISOString()).toBe("2026-09-13T12:00:00.000Z");
  });

  it("an event in the future has not ended", () => {
    expect(hasEnded({ date: day("2027-01-01"), dayCount: 1 }, at("2026-11-05T00:00:00Z"))).toBe(false);
  });

  it("a stale PUBLISHED or LIVE event is shown as ENDED, never Upcoming or Live", () => {
    const past = { date: day("2026-09-10"), dayCount: 1 };
    const now = at("2026-11-05T00:00:00Z");
    for (const status of ["PUBLISHED", "LIVE", "INTERMISSION"] as EventStatus[]) {
      expect(displayStatus({ ...past, status }, now)).toBe("ENDED");
    }
  });

  it("leaves honest statuses alone", () => {
    const past = { date: day("2026-09-10"), dayCount: 1 };
    const now = at("2026-11-05T00:00:00Z");
    for (const status of ["FINISHED", "CANCELLED", "ARCHIVED", "DRAFT", "READY"] as EventStatus[]) {
      expect(displayStatus({ ...past, status }, now)).toBe(status);
    }
    expect(displayStatus({ date: day("2026-11-05"), dayCount: 1, status: "LIVE" }, at("2026-11-05T19:00:00Z"))).toBe("LIVE");
  });

  it("swaps a status pill for 'Ended' only when stale", () => {
    const stale = { date: day("2026-09-10"), dayCount: 1, status: "LIVE" as EventStatus };
    const fresh = { date: day("2026-11-05"), dayCount: 1, status: "LIVE" as EventStatus };
    const now = at("2026-11-05T12:00:00Z");
    expect(pillWithEnded(stale, { text: "Live now", live: true }, now)).toEqual({ text: "Ended", live: false });
    expect(pillWithEnded(fresh, { text: "Live now", live: true }, now)).toEqual({ text: "Live now", live: true });
  });


  it("knows which days a multi-day event covers", () => {
    const e = { date: day("2026-09-10"), dayCount: 3 };
    expect(spansDay(e, utcDayStart(day("2026-09-10")))).toBe(true);
    expect(spansDay(e, utcDayStart(day("2026-09-12")))).toBe(true);
    expect(spansDay(e, utcDayStart(day("2026-09-13")))).toBe(false);
    expect(spansDay(e, utcDayStart(day("2026-09-09")))).toBe(false);
  });

  // The six events that were actually listed as Upcoming/Live when this was reported.
  const reported = [
    { name: "München Winter Cup", status: "LIVE", date: day("2026-09-10"), dayCount: 3 },
    { name: "Isar Fight Night", status: "LIVE", date: day("2026-09-11"), dayCount: 1 },
    { name: "Nürnberg Fight Night", status: "PUBLISHED", date: day("2026-09-16"), dayCount: 1 },
    { name: "Franken Fight Night", status: "PUBLISHED", date: day("2026-09-18"), dayCount: 1 },
    { name: "Nürnberg Night of Champions", status: "PUBLISHED", date: day("2026-10-01"), dayCount: 1 },
    { name: "München Fight Night", status: "PUBLISHED", date: day("2026-10-01"), dayCount: 1 },
  ] as const;

  it("stale-event rate on the reported data: 0 current events on 5 Nov 2026 (was 6 of 6 listed)", () => {
    const now = at("2026-11-05T00:44:00Z");
    expect(reported.filter((e) => !hasEnded(e, now))).toHaveLength(0);
  });

  it("the same events were genuinely current while they were running", () => {
    expect(reported.filter((e) => !hasEnded(e, at("2026-09-11T18:00:00Z"))).map((e) => e.name)).toEqual([
      "München Winter Cup",
      "Isar Fight Night",
      "Nürnberg Fight Night",
      "Franken Fight Night",
      "Nürnberg Night of Champions",
      "München Fight Night",
    ]);
  });
});

describe("bottom navigation highlights the page you are on", () => {
  const owner = (path: string): TabId[] =>
    (["home", "events", "scan", "clubs", "account", "control"] as TabId[]).filter((t) => isTabActive(t, path));

  it("Clubs highlights Clubs and never Scan", () => {
    expect(owner("/clubs")).toEqual(["clubs"]);
    expect(owner("/clubs/abc123")).toEqual(["clubs"]);
  });

  it("the club admin area belongs to Clubs too", () => {
    for (const p of ["/club", "/club/events", "/club/requests", "/club/fighters"]) expect(owner(p)).toEqual(["clubs"]);
  });

  it("each main page lights exactly its own tab", () => {
    expect(owner("/")).toEqual(["home"]);
    expect(owner("/events")).toEqual(["events"]);
    expect(owner("/scan")).toEqual(["scan"]);
    expect(owner("/account")).toEqual(["account"]);
    expect(owner("/account/settings")).toEqual(["account"]);
    expect(owner("/you/notifications")).toEqual(["account"]);
    expect(owner("/host/events/e1/live")).toEqual(["control"]);
  });

  it("pages reached from Explore keep Explore highlighted", () => {
    for (const p of ["/sparring", "/sparring/s1", "/search", "/fighters/f1"]) expect(owner(p)).toEqual(["home"]);
  });

  it("never highlights two tabs at once", () => {
    for (const p of ["/", "/events", "/scan", "/clubs", "/club", "/club/events", "/account", "/you", "/host", "/sparring", "/fighters/x"]) {
      expect(owner(p).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("registration validation", () => {
  it("explains an empty or malformed email", () => {
    expect(emailProblem("")).toMatch(/Enter your email/);
    expect(emailProblem("  ")).toMatch(/Enter your email/);
    expect(emailProblem("not-an-email")).toMatch(/valid email address/);
    expect(emailProblem("a@b")).toMatch(/valid email address/);
    expect(emailProblem("name@example.com")).toBeNull();
    expect(emailProblem("  name@example.com  ")).toBeNull();
  });

  it("tells the person how many characters are missing", () => {
    expect(passwordProblem("")).toMatch(/Choose a password/);
    expect(passwordProblem("abc")).toMatch(/at least 8 characters \(5 more\)/);
    expect(passwordProblem("1234567")).toMatch(/\(1 more\)/);
    expect(passwordProblem("12345678")).toBeNull();
  });

  it("the browser hint and the server check agree on what a valid email is", () => {
    for (const e of ["a@b.co", "x.y+z@sub.example.org", "no-at", "a b@c.com", "@x.com", "a@.com"]) {
      expect(emailProblem(e) === null).toBe(isPlausibleEmail(e));
    }
  });
});

describe("club directory has no duplicate listings", () => {
  const club = (id: string) => ({ id });
  const featured = [club("v1"), club("v2")];
  const all = [club("a"), club("v1"), club("b"), club("v2"), club("c")];
  const ids = (r: { featured: { id: string }[]; rest: { id: string }[] }) => [...r.featured, ...r.rest].map((c) => c.id);

  it("unfiltered: featured clubs appear once, in the shelf only (was 2 of 8 cards duplicated)", () => {
    const r = arrangeClubs(featured, all, false);
    expect(r.featured.map((c) => c.id)).toEqual(["v1", "v2"]);
    expect(r.rest.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(new Set(ids(r)).size).toBe(ids(r).length);
    expect(ids(r).sort()).toEqual(all.map((c) => c.id).sort());
  });

  it("filtered or searched: one flat list of matches and no featured shelf", () => {
    const r = arrangeClubs(featured, [club("v1"), club("b")], true);
    expect(r.featured).toEqual([]);
    expect(r.rest.map((c) => c.id)).toEqual(["v1", "b"]);
  });

  it("never loses a club", () => {
    expect(arrangeClubs([club("only")], [club("only")], false)).toEqual({ featured: [club("only")], rest: [] });
    expect(arrangeClubs([], all, false).rest).toHaveLength(5);
  });
});

describe("optional personalization", () => {
  type Ev = { id: string; status: EventStatus; date: Date; sport: string; city: string | null };
  const ev = (id: string, date: string, sport: string, city: string | null, status: EventStatus = "PUBLISHED"): Ev => ({
    id,
    status,
    date: day(date),
    sport,
    city,
  });
  const list = [
    ev("boxing-berlin", "2026-12-01", "Boxing", "Berlin"),
    ev("mma-munich", "2026-12-02", "MMA", "München"),
    ev("boxing-munich", "2026-12-03", "Boxing", "München"),
    ev("live-berlin", "2026-12-09", "Boxing", "Berlin", "LIVE"),
  ];
  const ids = (events: Ev[]) => events.map((e) => e.id);

  it("with no picks the order is just live first, then soonest first", () => {
    expect(ids(personalize(list, EMPTY_PREFS))).toEqual(["live-berlin", "boxing-berlin", "mma-munich", "boxing-munich"]);
  });

  it("puts matching events ahead of the rest but never drops any", () => {
    const prefs: Prefs = { sports: ["Boxing"], city: "München", dismissed: true };
    const out = personalize(list, prefs);
    expect(ids(out)).toEqual(["live-berlin", "boxing-munich", "mma-munich", "boxing-berlin"]);
    expect(out).toHaveLength(list.length);
  });

  it("a live event still comes first even when it does not match", () => {
    const prefs: Prefs = { sports: ["MMA"], city: "München", dismissed: true };
    expect(personalize(list, prefs)[0]?.id).toBe("live-berlin");
  });

  it("a city match outweighs a sport match, and matching ignores case", () => {
    const prefs: Prefs = { sports: ["Boxing"], city: "münchen", dismissed: true };
    expect(prefScore({ sport: "MMA", city: "München" }, prefs)).toBe(2);
    expect(prefScore({ sport: "boxing", city: "Berlin" }, prefs)).toBe(1);
    expect(prefScore({ sport: "MMA", city: null }, prefs)).toBe(0);
  });

  it("does not mutate the list it was given", () => {
    const copy = ids(list);
    personalize(list, { sports: ["MMA"], city: "", dismissed: true });
    expect(ids(list)).toEqual(copy);
  });

  it("reads the cookie defensively: bad, hostile or unknown values mean no picks", () => {
    expect(parsePrefs(undefined)).toEqual(EMPTY_PREFS);
    expect(parsePrefs("not json")).toEqual(EMPTY_PREFS);
    expect(parsePrefs("null")).toEqual(EMPTY_PREFS);
    expect(parsePrefs(JSON.stringify({ sports: ["Chess", "MMA"], city: 7, dismissed: "yes" }))).toEqual({
      sports: ["MMA"],
      city: "",
      dismissed: false,
    });
  });

  it("keeps the city short and free of control characters", () => {
    const parsed = parsePrefs(JSON.stringify({ sports: [], city: `  Mün\u0000chen\n${"x".repeat(100)}` }));
    expect(parsed.city.length).toBeLessThanOrEqual(60);
    expect(parsed.city).not.toMatch(/[\u0000-\u001f]/);
    expect(parsed.city.startsWith("Mün chen")).toBe(true);
  });

  it("round-trips what it saves", () => {
    const prefs: Prefs = { sports: ["Boxing", "MMA"], city: "Nürnberg", dismissed: true };
    expect(parsePrefs(serializePrefs(prefs))).toEqual(prefs);
  });
});
