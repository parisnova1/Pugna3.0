import { formatUpdatedAt } from "@/lib/format";

export function FreshnessMeter({ updatedAt, connectionLost }: { updatedAt: Date; connectionLost: boolean }) {
  return (
    <p className="text-[11px] text-mute tabular">
      {connectionLost ? (
        <>Connection lost · Showing last update {formatUpdatedAt(updatedAt)} · Retrying…</>
      ) : (
        <>Updated {formatUpdatedAt(updatedAt)}</>
      )}
    </p>
  );
}
