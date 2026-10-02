import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-20 text-center space-y-4">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-mute text-sm">That page doesn&apos;t exist.</p>
      <div className="flex justify-center gap-2 pt-2">
        <Link href="/scan" className={buttonClass({ text: "sm", className: "px-5" })}>
          Scan QR
        </Link>
        <Link href="/" className={buttonClass({ variant: "outline", text: "sm", className: "px-5" })}>
          Home
        </Link>
      </div>
    </div>
  );
}
