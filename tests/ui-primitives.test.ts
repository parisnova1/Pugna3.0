import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buttonClass } from "@/components/ui/buttonClass";
import { inputClass } from "@/components/ui/inputClass";

const ROOT = path.resolve(__dirname, "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const files = [...sourceFiles(path.join(ROOT, "app")), ...sourceFiles(path.join(ROOT, "components"))];
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");
const tokens = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

describe("buttonClass reproduces the hand-rolled buttons it replaced", () => {
  // [original class string, buttonClass options]; the original also gains disabled:opacity-60.
  const cases: [string, Parameters<typeof buttonClass>[0]][] = [
    ["w-full rounded-pill bg-signal text-onsignal font-semibold py-3", { fullWidth: true }],
    ["w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm disabled:opacity-60", { fullWidth: true, text: "sm" }],
    ["inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm", { text: "sm", className: "inline-block px-5" }],
    ["w-full rounded-pill border border-white/20 text-ink font-semibold py-2 text-sm", { variant: "outline", size: "xs", text: "sm", fullWidth: true }],
    ["rounded-pill border border-white/20 text-ink text-sm font-medium px-4 py-2", { variant: "outline", size: "xs", text: "sm", weight: "medium", className: "px-4" }],
    ["w-full rounded-pill border border-signal text-signal font-semibold py-2 text-sm", { variant: "signalOutline", size: "xs", text: "sm", fullWidth: true }],
    ["w-full rounded-pill bg-error text-ink font-semibold py-3 disabled:opacity-60", { variant: "danger", fullWidth: true }],
    ["w-full rounded-pill border border-error/40 text-error font-semibold py-2.5 text-sm", { variant: "dangerOutline", size: "sm", text: "sm", fullWidth: true }],
    ["w-full rounded-pill bg-signal text-onsignal font-bold py-3.5", { size: "lg", weight: "bold", fullWidth: true }],
  ];

  it.each(cases)("%s", (original, options) => {
    const expected = tokens(`${original} disabled:opacity-60`);
    expect(tokens(buttonClass(options))).toEqual(expected);
  });
});

describe("inputClass", () => {
  it("is the standard form field style", () => {
    expect(inputClass).toBe("w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute");
  });
});

describe("no re-introduced duplicates", () => {
  it("only components/ui/Modal.tsx builds a bottom sheet", () => {
    const offenders = files.filter((f) => rel(f) !== "components/ui/Modal.tsx" && fs.readFileSync(f, "utf-8").includes("fixed inset-0 z-50"));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("no new hand-rolled primary pill buttons (use <Button> / buttonClass)", () => {
    // Known exceptions: a disabled:opacity-40 outlier and a grid cell with col-span-2.
    const allowed = ["app/(shell)/host/events/[id]/review/page.tsx", "app/(shell)/sparring/page.tsx"];
    const sizeTokens = new Set(["py-3.5", "py-3", "py-2.5", "py-2", "py-1.5"]);
    const offenders: string[] = [];
    for (const file of files) {
      if (allowed.includes(rel(file))) continue;
      const source = fs.readFileSync(file, "utf-8");
      for (const match of source.matchAll(/className="([^"]*)"/g)) {
        const t = match[1]!.split(/\s+/);
        if (t.includes("rounded-pill") && t.includes("bg-signal") && t.includes("text-onsignal") && t.some((x) => sizeTokens.has(x))) {
          offenders.push(`${rel(file)}: ${match[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
