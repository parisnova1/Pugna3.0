export function SportTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold text-mute uppercase tracking-wide border border-white/10 rounded-pill px-2 py-0.5">
      {children}
    </span>
  );
}
