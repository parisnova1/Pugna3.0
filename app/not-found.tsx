import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-20 text-center space-y-4">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-mute text-sm">That page doesn&apos;t exist.</p>
      <div className="flex justify-center gap-2 pt-2">
        <Link href="/scan" className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
          Scan QR
        </Link>
        <Link href="/" className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}
