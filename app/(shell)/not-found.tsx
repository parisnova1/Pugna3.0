import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

/** Renders inside the shell, so a missing page still has the tab bar. */
export default function ShellNotFound() {
  return (
    <div className="pt-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-mute text-sm">That page doesn&apos;t exist.</p>
      <div className="flex justify-center gap-2 pt-2">
        <Link href="/" className={buttonClass({ text: "sm", className: "px-5" })}>
          Home
        </Link>
        <Link href="/events" className={buttonClass({ variant: "outline", text: "sm", className: "px-5" })}>
          Events
        </Link>
      </div>
    </div>
  );
}
