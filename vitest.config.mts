import { defineConfig } from "vitest/config";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Optional, git-ignored `.env.test` (e.g. TEST_DATABASE_URL for the Postgres
// integration tests). Real environment variables take precedence.
const envFile = fileURLToPath(new URL("./.env.test", import.meta.url));
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf-8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (match && process.env[match[1]!] === undefined) process.env[match[1]!] = match[2]!;
  }
}

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
