import Link from "next/link";

export type BracketBout = {
  id: string;
  fighterAName: string | null;
  fighterBName: string | null;
  status: string;
  resultSummary?: string | null;
  /** true = fighter A won, false = fighter B won, null = not decided yet. */
  aWon?: boolean | null;
};

export type BracketRound = {
  label: string;
  bouts: BracketBout[];
};

const BOX_W = 152;
const BOX_H = 58;
const GAP_Y = 18;
const COL_GAP = 48;
const LABEL_H = 28;

/** A bracket only makes sense to draw when round sizes actually halve down to 1 (4 -> 2 -> 1, etc). */
export function isValidBracket(rounds: BracketRound[]): boolean {
  const firstRound = rounds[0];
  const lastRound = rounds[rounds.length - 1];
  if (rounds.length < 2 || !firstRound || !lastRound) return false;
  const first = firstRound.bouts.length;
  if (first < 2 || (first & (first - 1)) !== 0) return false;
  let expected = first;
  for (const round of rounds) {
    if (round.bouts.length !== expected) return false;
    expected = expected / 2;
  }
  return lastRound.bouts.length === 1;
}

export function roundLabelForSize(size: number): string {
  if (size === 1) return "Final";
  if (size === 2) return "Semifinals";
  if (size === 4) return "Quarterfinals";
  return `Round of ${size * 2}`;
}

export function BracketDiagram({ slug, rounds }: { slug: string; rounds: BracketRound[] }) {
  const centers: number[][] = [];
  rounds.forEach((round, r) => {
    if (r === 0) {
      centers.push(round.bouts.map((_, i) => i * (BOX_H + GAP_Y) + BOX_H / 2));
    } else {
      const prev = centers[r - 1]!;
      centers.push(round.bouts.map((_, j) => (prev[2 * j]! + prev[2 * j + 1]!) / 2));
    }
  });

  const bodyHeight = Math.max(...centers[0]!) + BOX_H / 2;
  const totalHeight = bodyHeight + LABEL_H;
  const totalWidth = rounds.length * BOX_W + (rounds.length - 1) * COL_GAP;

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
        <svg className="absolute left-0 pointer-events-none" style={{ top: LABEL_H }} width={totalWidth} height={bodyHeight}>
          {rounds.slice(0, -1).map((round, r) =>
            round.bouts.map((_, i) => {
              if (i % 2 === 1) return null;
              const xRight = r * (BOX_W + COL_GAP) + BOX_W;
              const xMid = xRight + COL_GAP / 2;
              const xNext = (r + 1) * (BOX_W + COL_GAP);
              const y0 = centers[r]![i]!;
              const y1 = centers[r]![i + 1]!;
              const yNext = centers[r + 1]![i / 2]!;
              return (
                <g key={`${r}-${i}`} stroke="rgba(255,255,255,0.22)" strokeWidth={1.5} fill="none">
                  <line x1={xRight} y1={y0} x2={xMid} y2={y0} />
                  <line x1={xRight} y1={y1} x2={xMid} y2={y1} />
                  <line x1={xMid} y1={y0} x2={xMid} y2={y1} />
                  <line x1={xMid} y1={yNext} x2={xNext} y2={yNext} />
                </g>
              );
            }),
          )}
        </svg>

        {rounds.map((round, r) => (
          <div key={round.label}>
            <p
              className="absolute text-[11px] font-semibold text-mute uppercase tracking-wide"
              style={{ left: r * (BOX_W + COL_GAP), top: 0, width: BOX_W }}
            >
              {round.label}
            </p>
            {round.bouts.map((bout, i) => {
              const isLive = bout.status === "IN_PROGRESS";
              const isFinal = bout.status === "FINAL";
              return (
                <Link
                  key={bout.id}
                  href={`/e/${slug}/bout/${bout.id}`}
                  className={[
                    "absolute flex flex-col justify-center rounded-card border px-3 py-1 text-xs overflow-hidden",
                    isLive ? "border-signal/50 bg-signal/10" : "border-white/10 bg-panel",
                  ].join(" ")}
                  style={{
                    left: r * (BOX_W + COL_GAP),
                    top: LABEL_H + centers[r]![i]! - BOX_H / 2,
                    width: BOX_W,
                    height: BOX_H,
                  }}
                >
                  {isLive && (
                    <span className="absolute top-1 right-2 text-[9px] font-semibold text-signal tracking-wide">LIVE</span>
                  )}
                  <p className={`truncate ${bout.aWon === false ? "text-mute" : "font-medium"}`}>{bout.fighterAName ?? "TBD"}</p>
                  <p className={`truncate ${bout.aWon === true ? "text-mute" : "font-medium"}`}>{bout.fighterBName ?? "TBD"}</p>
                  {isFinal && bout.resultSummary && (
                    <p className="truncate text-[10px] text-mute mt-0.5">{bout.resultSummary}</p>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
