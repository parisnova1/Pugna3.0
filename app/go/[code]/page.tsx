import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function GoResolverPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const event = await prisma.event.findUnique({ where: { code } });

  if (event?.slug) {
    redirect(`/e/${event.slug}`);
  }

  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Link not found</h1>
      <p className="text-mute text-sm">This fight link doesn&apos;t match an event.</p>
      <div className="flex justify-center gap-2 pt-2">
        <Link href="/scan" className="rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
          Scan QR
        </Link>
        <Link href="/" className="rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
          Discover
        </Link>
      </div>
    </div>
  );
}
