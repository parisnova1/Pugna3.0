import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { isVotableBoutStatus, isVotingOpen, tallyVotes, voterKeyFor } from "@/lib/fight-vote";
import { parseWaitlistForm, waitlistLocale } from "@/lib/waitlist";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("fight of the day", () => {
  it("only lets people vote for fights that have started or finished", () => {
    expect(isVotableBoutStatus("IN_PROGRESS")).toBe(true);
    expect(isVotableBoutStatus("FINAL")).toBe(true);
    for (const status of ["DRAFT", "TBD", "CONFIRMED", "READY", "DELAYED", "SCRATCHED", "NO_SHOW"]) {
      expect(isVotableBoutStatus(status), status).toBe(false);
    }
  });

  it("keeps voting shut on unpublished, cancelled and archived events", () => {
    for (const status of ["PUBLISHED", "LIVE", "INTERMISSION", "FINISHED"]) expect(isVotingOpen(status), status).toBe(true);
    for (const status of ["DRAFT", "READY", "CANCELLED", "ARCHIVED"]) expect(isVotingOpen(status), status).toBe(false);
  });

  it("keys accounts and anonymous browsers in separate namespaces", () => {
    expect(voterKeyFor({ userId: "abc", guestId: "cookie" })).toBe("u:abc");
    const guest = voterKeyFor({ guestId: "abc" });
    expect(guest).toMatch(/^g:[0-9a-f]{64}$/);
    expect(guest).not.toContain("abc");
    expect(voterKeyFor({ guestId: "abc" })).toBe(guest);
    expect(voterKeyFor({})).toBeNull();
  });

  it("tallies shares and flags every tied leader", () => {
    const { total, rows } = tallyVotes(["a", "b", "c"], new Map([["a", 3], ["b", 3], ["x", 9]]));
    expect(total).toBe(6);
    expect(rows).toEqual([
      { boutId: "a", votes: 3, share: 50, leading: true },
      { boutId: "b", votes: 3, share: 50, leading: true },
      { boutId: "c", votes: 0, share: 0, leading: false },
    ]);
  });

  it("flags nobody as leading before the first vote", () => {
    const { total, rows } = tallyVotes(["a", "b"], new Map());
    expect(total).toBe(0);
    expect(rows.every((r) => !r.leading && r.share === 0)).toBe(true);
  });
});

describe("waitlist form", () => {
  it("normalises a coach signup", () => {
    const parsed = parseWaitlistForm(
      form({ email: "  Trainer@Example.DE ", consent: "on", role: "coach", clubName: "  BC   Muster ", newsletter: "on", from: "bayerische-meisterschaft", locale: "de" }),
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        email: "trainer@example.de",
        name: null,
        role: "COACH",
        clubName: "BC Muster",
        city: null,
        newsletter: true,
        source: "bayerische-meisterschaft",
        locale: "de",
      },
    });
  });

  it("rejects a bad email and a missing consent tick", () => {
    expect(parseWaitlistForm(form({ email: "nope", consent: "on" }))).toEqual({ ok: false, field: "email" });
    expect(parseWaitlistForm(form({ email: "a@b.de" }))).toEqual({ ok: false, field: "consent" });
  });

  it("falls back to safe defaults for an unknown role or a malformed source", () => {
    const parsed = parseWaitlistForm(form({ email: "a@b.de", consent: "on", role: "admin", from: "../../etc" }));
    expect(parsed.ok && parsed.value.role).toBe("FAN");
    expect(parsed.ok && parsed.value.source).toBe("site");
    expect(parsed.ok && parsed.value.newsletter).toBe(false);
  });

  it("treats a filled honeypot as a bot", () => {
    expect(parseWaitlistForm(form({ email: "a@b.de", consent: "on", website: "http://spam" }))).toEqual({ ok: false, field: "form" });
  });

  it("picks German for German browsers unless a language is chosen", () => {
    expect(waitlistLocale(undefined, "de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(waitlistLocale(undefined, "en-US")).toBe("en");
    expect(waitlistLocale(undefined, null)).toBe("en");
    expect(waitlistLocale("en", "de-DE")).toBe("en");
  });
});

describe("waitlist page and the onboarding gate", () => {
  it("opens directly for a first-time visitor from a QR code", () => {
    const headers = new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1" });
    const res = middleware(new NextRequest("http://localhost:3000/waitlist?from=some-event", { headers }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
