export function LiveDot({ className = "" }: { className?: string }) {
  return <span className={`live-pulse inline-block w-1.5 h-1.5 rounded-full bg-signal ${className}`} />;
}
