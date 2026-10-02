import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/security/client-ip";
import { POLICIES } from "@/lib/security/policies";
import { rateLimit } from "@/lib/security/rate-limit-db";
import { buttonClass } from "@/components/ui/Button";

export default async function GoResolverPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Short codes are guessable, so cap lookups per address before touching the database.
  const limit = await rateLimit([{ policy: POLICIES.codeLookupIp, subject: clientIp(await headers()) }]);
  if (!limit.ok) {
    return (
      <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-4">
        <h1 className="text-xl font-semibold">Slow down</h1>
        <p className="text-mute text-sm">Too many lookups. Try again in a few minutes.</p>
      </div>
    );
  }

  const event = await prisma.event.findUnique({ where: { code } });

  if (event?.slug) {
    redirect(`/e/${event.slug}`);
  }

  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Link not found</h1>
      <p className="text-mute text-sm">This fight link doesn&apos;t match an event.</p>
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
