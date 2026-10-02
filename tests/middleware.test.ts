import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const HUMAN = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function request(path: string, opts: { ua?: string; cookies?: string; method?: string } = {}) {
  const headers = new Headers({ "user-agent": opts.ua ?? HUMAN });
  if (opts.cookies) headers.set("cookie", opts.cookies);
  return new NextRequest(`http://localhost:3000${path}`, { headers, method: opts.method ?? "GET" });
}

describe("onboarding gate", () => {
  it("redirects a first-time human to /onboarding and preserves the deep link", () => {
    const res = middleware(request("/e/some-event"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/onboarding");
    expect(location.searchParams.get("returnTo")).toBe("/e/some-event");
  });

  it("sets a short-lived (3 day) gate cookie, not a year-long one", () => {
    const res = middleware(request("/events"));
    const cookie = res.cookies.get("pugna_onboarding_version");
    expect(cookie?.value).toBe("1");
    expect(cookie?.maxAge).toBe(60 * 60 * 24 * 3);
  });

  it("lets crawlers and link unfurlers reach the real page (SEO)", () => {
    for (const path of ["/", "/events", "/e/some-event", "/clubs/abc", "/fighters/abc"]) {
      const res = middleware(request(path, { ua: GOOGLEBOT }));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("location"), path).toBeNull();
    }
  });

  it("still gates a human on the same URL a crawler can read", () => {
    expect(middleware(request("/e/some-event")).status).toBe(307);
    expect(middleware(request("/e/some-event", { ua: GOOGLEBOT })).status).toBe(200);
  });

  it("slides the cookie forward while the visitor is within the window", () => {
    const res = middleware(request("/events", { cookies: "pugna_onboarding_version=1" }));
    expect(res.status).toBe(200);
    expect(res.cookies.get("pugna_onboarding_version")?.maxAge).toBe(60 * 60 * 24 * 3);
  });

  it("re-gates a guest once the cookie has lapsed", () => {
    expect(middleware(request("/events")).status).toBe(307);
  });

  it("re-gates when the cookie holds a stale onboarding version", () => {
    expect(middleware(request("/events", { cookies: "pugna_onboarding_version=0" })).status).toBe(307);
  });

  it("never gates an authenticated session, regardless of the gate cookie", () => {
    for (const name of ["authjs.session-token", "__Secure-authjs.session-token"]) {
      const res = middleware(request("/events", { cookies: `${name}=abc` }));
      expect(res.status).toBe(200);
    }
  });

  it("exempts /onboarding, /account and /api to avoid loops", () => {
    for (const path of ["/onboarding", "/account", "/account/settings", "/api/auth/session"]) {
      expect(middleware(request(path)).status, path).toBe(200);
    }
  });

  it("never intercepts non-GET requests (server actions) or static files", () => {
    expect(middleware(request("/events", { method: "POST" })).status).toBe(200);
    expect(middleware(request("/robots.txt")).status).toBe(200);
    expect(middleware(request("/sitemap.xml")).status).toBe(200);
  });
});
