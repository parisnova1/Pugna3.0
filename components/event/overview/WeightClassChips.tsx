import Link from "next/link";

export function WeightClassChips({
  slug,
  weight,
  weightClasses,
  buildQuery,
}: {
  slug: string;
  weight?: string;
  weightClasses: string[];
  buildQuery: (changes: { day?: string; weight?: string }) => string;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      <Link
        href={`/e/${slug}${buildQuery({ weight: undefined })}`}
        className={[
          "rounded-pill border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
          !weight ? "border-signal bg-signal/10 text-ink" : "border-white/10 text-mute",
        ].join(" ")}
      >
        All
      </Link>
      {weightClasses.map((w) => (
        <Link
          key={w}
          href={`/e/${slug}${buildQuery({ weight: w })}`}
          className={[
            "rounded-pill border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
            w === weight ? "border-signal bg-signal/10 text-ink" : "border-white/10 text-mute",
          ].join(" ")}
        >
          {w}
        </Link>
      ))}
    </div>
  );
}
