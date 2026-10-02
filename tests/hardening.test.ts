import { describe, expect, it } from "vitest";
import { can, type Actor } from "@/lib/rbac";
import { MAX_UPLOAD_BYTES, safeFileName, sniffImageType } from "@/lib/security/upload";

const bytes = (...values: (number | string)[]) =>
  Uint8Array.from(values.flatMap((v) => (typeof v === "number" ? [v] : [...v].map((c) => c.charCodeAt(0)))));
const pad = (b: Uint8Array, n = 16) => Uint8Array.from([...b, ...new Array(Math.max(0, n - b.length)).fill(0)]);

describe("upload content sniffing", () => {
  it("accepts real raster image signatures", () => {
    expect(sniffImageType(pad(bytes(0xff, 0xd8, 0xff, 0xe0)))).toBe("image/jpeg");
    expect(sniffImageType(pad(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a)))).toBe("image/png");
    expect(sniffImageType(pad(bytes("GIF89a")))).toBe("image/gif");
    expect(sniffImageType(pad(bytes("RIFF", 0, 0, 0, 0, "WEBP")))).toBe("image/webp");
    expect(sniffImageType(pad(bytes(0, 0, 0, 0x20, "ftypavif")))).toBe("image/avif");
  });

  it("rejects HTML, SVG, scripts and executables even if they were labelled image/png", () => {
    expect(sniffImageType(pad(bytes("<!DOCTYPE html><script>alert(1)</script>")))).toBeNull();
    expect(sniffImageType(pad(bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')))).toBeNull();
    expect(sniffImageType(pad(bytes("#!/bin/sh\nrm -rf /")))).toBeNull();
    expect(sniffImageType(pad(bytes("MZ", 0x90, 0)))).toBeNull();
  });

  it("rejects truncated or empty input", () => {
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff))).toBeNull();
  });

  it("caps uploads at 4 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });
});

describe("safeFileName", () => {
  it("strips path traversal and odd characters", () => {
    expect(safeFileName("../../etc/passwd")).not.toMatch(/\.\.|\//);
    expect(safeFileName("a b/c\\d.png")).toBe("a_b_c_d.png");
    expect(safeFileName("<script>.png")).toBe("_script_.png");
  });
  it("bounds the length and never returns empty", () => {
    expect(safeFileName("x".repeat(500)).length).toBeLessThanOrEqual(80);
    expect(safeFileName("")).toBe("upload");
  });
});

const actor = (emailVerified: boolean): Actor => ({
  userId: "u1",
  isBoxer: false,
  clubIds: [],
  isOrganizer: true,
  emailVerified,
  hostEventIds: [],
  hostRoles: {},
  clubRoles: {},
});

describe("unconfirmed email can't create abusable things", () => {
  it("blocks creating events and claiming clubs until the address is confirmed", () => {
    for (const action of ["event.create", "club.claim"] as const) {
      const denied = can(actor(false), action, { clubClaimed: false });
      expect(denied).toMatchObject({ allowed: false, code: "EMAIL_UNVERIFIED" });
    }
  });

  it("allows them once confirmed", () => {
    expect(can(actor(true), "event.create")).toEqual({ allowed: true });
    expect(can(actor(true), "club.claim", { clubClaimed: false })).toEqual({ allowed: true });
  });

  it("doesn't touch read-only or non-creating actions", () => {
    expect(can(actor(false), "event.view", { eventPublished: true })).toEqual({ allowed: true });
    expect(can(actor(false), "club.follow")).toEqual({ allowed: true });
  });

  it("guests still get a sign-in prompt, not a verification one", () => {
    expect(can(null, "event.create")).toMatchObject({ allowed: false, code: "AUTH_REQUIRED" });
  });
});

import { isSessionRevoked } from "@/lib/security/session";

describe("session revocation", () => {
  const changedAt = new Date("2026-03-01T12:00:00.000Z");
  const before = changedAt.getTime() - 60_000;
  const after = changedAt.getTime() + 60_000;

  it("never revokes when the credentials were never changed", () => {
    expect(isSessionRevoked({ authAt: before, passwordChangedAt: null, trustedSessionAt: null })).toBe(false);
    expect(isSessionRevoked({ authAt: undefined, passwordChangedAt: null, trustedSessionAt: null })).toBe(false);
  });

  it("revokes sessions that started before a password change (stolen-session defence)", () => {
    expect(isSessionRevoked({ authAt: before, passwordChangedAt: changedAt, trustedSessionAt: null })).toBe(true);
  });

  it("keeps sessions that started after the change", () => {
    expect(isSessionRevoked({ authAt: after, passwordChangedAt: changedAt, trustedSessionAt: null })).toBe(false);
    expect(isSessionRevoked({ authAt: changedAt.getTime(), passwordChangedAt: changedAt, trustedSessionAt: null })).toBe(false);
  });

  it("spares only the session that made a voluntary change, never another old one", () => {
    const trusted = new Date(before);
    expect(isSessionRevoked({ authAt: before, passwordChangedAt: changedAt, trustedSessionAt: trusted })).toBe(false);
    expect(isSessionRevoked({ authAt: before - 5_000, passwordChangedAt: changedAt, trustedSessionAt: trusted })).toBe(true);
  });

  it("revokes sessions with no recorded start once a change exists", () => {
    expect(isSessionRevoked({ authAt: undefined, passwordChangedAt: changedAt, trustedSessionAt: null })).toBe(true);
  });
});
