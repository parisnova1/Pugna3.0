import fs from "node:fs";
import path from "node:path";

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/-pooler/, "");
  } catch {
    return url;
  }
};

/** Throws if `testUrl` points at the same database server as the app's real DATABASE_URL(s). */
export function assertNotProduction(testUrl: string): void {
  const root = path.resolve(__dirname, "..", "..");
  for (const file of [".env", ".env.local"]) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const match = fs.readFileSync(full, "utf-8").match(/^(?:DATABASE_URL|POSTGRES_PRISMA_URL|POSTGRES_URL)="?([^"\r\n]+)"?/gm) ?? [];
    for (const line of match) {
      const value = line.replace(/^[A-Z_]+="?/, "").replace(/"$/, "");
      if (hostOf(value) === hostOf(testUrl)) {
        throw new Error(`TEST_DATABASE_URL points at the same server as ${file}; refusing to run integration tests against production.`);
      }
    }
  }
}
