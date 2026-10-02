/**
 * Client address used as a rate-limit subject. Trusts x-real-ip /
 * x-forwarded-for because on Vercel the platform overwrites both, so a client
 * can't choose its own value; if this app is ever served behind a proxy that
 * appends rather than overwrites, revisit this.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
