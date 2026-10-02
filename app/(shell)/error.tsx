"use client";

import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";

/** Renders inside the shell, so the tab bar stays usable when a page fails. */
export default function ShellError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-mute text-sm">Try again in a moment.</p>
      <div className="flex justify-center gap-2 pt-2">
        <Button onClick={reset} text="sm" className="px-5">
          Try again
        </Button>
        <Link href="/" className={buttonClass({ variant: "outline", text: "sm", className: "px-5" })}>
          Home
        </Link>
      </div>
    </div>
  );
}
