/**
 * Raw palette values for the handful of consumers that can't read a CSS
 * custom property — the qrcode library's color option, a Leaflet marker
 * built from an HTML string, and the static favicon SVG. Every other color
 * in the app should go through Tailwind's token classes (bg-panel,
 * text-mute, bg-signal, bg-live, bg-success, ...), which read from the same
 * values via `var(--x)` in app/globals.css. Keep these in sync with :root.
 */
export const THEME = {
  void: "#0B0B0C",
  panel: "#151517",
  ink: "#F5F3EE",
  mute: "#A7A5A0",
  signal: "#E85D3F",
  onsignal: "#0B0B0C",
  live: "#E5484D",
  success: "#35B779",
  warning: "#E6A23C",
  error: "#E05252",
} as const;
