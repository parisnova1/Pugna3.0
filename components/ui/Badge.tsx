export function Badge({
  children,
  live,
  tone = "neutral",
}: {
  children: React.ReactNode;
  live?: boolean;
  tone?: "neutral" | "signal";
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide rounded-pill px-2 py-0.5",
        tone === "signal" ? "bg-signal text-onsignal" : "text-mute border border-white/10",
      ].join(" ")}
    >
      {live && <span className="live-pulse w-1.5 h-1.5 rounded-full bg-onsignal" />}
      {children}
    </span>
  );
}
