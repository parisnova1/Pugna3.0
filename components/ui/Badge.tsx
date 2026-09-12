const TONE_CLASSES: Record<string, string> = {
  neutral: "text-mute border border-white/10",
  signal: "bg-signal text-onsignal",
  live: "bg-live text-onsignal",
  success: "bg-success text-onsignal",
  warning: "bg-warning text-onsignal",
  error: "bg-error text-onsignal",
};

export function Badge({
  children,
  live,
  tone = "neutral",
}: {
  children: React.ReactNode;
  live?: boolean;
  tone?: "neutral" | "signal" | "live" | "success" | "warning" | "error";
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide rounded-pill px-2 py-0.5",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
      {live && <span className="live-pulse w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
