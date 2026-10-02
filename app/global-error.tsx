"use client";

import "./globals.css";
import { Button } from "@/components/ui/Button";

/** Last resort: catches a failure in the root layout itself, which app/error.tsx cannot. */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-void text-ink min-h-screen">
        <div className="mx-auto w-full max-w-md px-4 pt-20 text-center space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-mute text-sm">Try again in a moment.</p>
          <Button onClick={reset} text="sm" className="px-5">
            Try again
          </Button>
        </div>
      </body>
    </html>
  );
}
