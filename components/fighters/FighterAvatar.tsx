/** Same shape as ClubAvatar (components/clubs/ClubCard.tsx) — a real photo when one
 * exists, otherwise an initial-letter placeholder. Never a broken image or empty box. */
export function FighterAvatar({ name, avatarUrl, size = 56 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        loading="lazy"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-card object-cover border border-white/10"
      />
    );
  }
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 rounded-card bg-signal/10 border border-signal/20 flex items-center justify-center"
    >
      <span className="font-bold text-signal" style={{ fontSize: size * 0.4 }}>
        {initial}
      </span>
    </div>
  );
}
