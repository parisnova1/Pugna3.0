"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-20 text-center space-y-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-mute text-sm">Try again in a moment.</p>
      <button
        onClick={reset}
        className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm"
      >
        Try again
      </button>
    </div>
  );
}
