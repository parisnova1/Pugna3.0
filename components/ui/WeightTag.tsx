export function WeightTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-[11px] font-medium text-mute border border-white/10 rounded-pill px-2 py-0.5 tabular">
      {children}
    </span>
  );
}
