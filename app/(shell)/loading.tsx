export default function ShellLoading() {
  return (
    <div role="status" aria-live="polite" className="pt-24 flex justify-center">
      <div aria-hidden="true" className="w-6 h-6 rounded-full border-2 border-white/15 border-t-signal animate-spin" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
