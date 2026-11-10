import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildMetadata } from "@/lib/seo";
import { isPublishedEventStatus } from "@/lib/event-status";
import { WAITLIST_COPY } from "@/lib/waitlist-copy";
import { WAITLIST_ROLES, waitlistLocale, type WaitlistRoleValue } from "@/lib/waitlist";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

export const metadata: Metadata = buildMetadata({
  title: "Join the Pugna waiting list",
  description:
    "Pugna shows fight cards, live results and brackets for combat sports events. Coaches, fighters, organizers and fans: leave your email and hear first when it opens.",
  path: "/waitlist",
});

/** Only an https Instagram profile is ever linked, whatever the env var holds. */
function instagramUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim();
  return raw && /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/.test(raw) ? raw : null;
}

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; lang?: string; role?: string }>;
}) {
  const { from, lang, role } = await searchParams;
  const locale = waitlistLocale(lang, (await headers()).get("accept-language"));
  const t = WAITLIST_COPY[locale];

  // "from" is an event slug carried by the QR code or the event page. It is only
  // trusted (and linked back to) when it names a real, published event.
  const slug = from && /^[a-z0-9-]{1,80}$/.test(from) ? from : null;
  const event = slug
    ? await prisma.event.findUnique({ where: { slug }, select: { slug: true, name: true, status: true } }).catch(() => null)
    : null;
  const sourceEvent = event && isPublishedEventStatus(event.status) ? event : null;

  const roleUpper = (role ?? "").toUpperCase();
  const defaultRole: WaitlistRoleValue = (WAITLIST_ROLES as readonly string[]).includes(roleUpper)
    ? (roleUpper as WaitlistRoleValue)
    : "COACH";

  const otherLocale = locale === "de" ? "en" : "de";
  const langParams = new URLSearchParams({ lang: otherLocale });
  if (sourceEvent?.slug) langParams.set("from", sourceEvent.slug);
  const instagram = instagramUrl();

  return (
    <main lang={locale} className="mx-auto w-full max-w-md lg:max-w-5xl px-4 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-wide">
          PUGNA
        </Link>
        <Link href={`/waitlist?${langParams.toString()}`} className="text-sm text-mute underline underline-offset-4">
          {t.otherLanguage}
        </Link>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">
        <div>
          <p className="text-xs font-semibold text-signal-ink uppercase tracking-wide">{t.eyebrow}</p>
          <h1 className="mt-2 text-3xl lg:text-4xl font-semibold leading-tight">{t.title}</h1>
          <p className="mt-3 text-mute">{t.lead}</p>

          {sourceEvent?.slug && (
            <Link
              href={`/e/${sourceEvent.slug}`}
              className="mt-4 inline-block rounded-pill border border-white/20 px-4 py-2 text-sm"
            >
              {sourceEvent.name} →
            </Link>
          )}

          <dl className="mt-8 space-y-4">
            {t.points.map((point) => (
              <div key={point.title}>
                <dt className="text-sm font-semibold">{point.title}</dt>
                <dd className="text-sm text-mute mt-0.5">{point.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-8 lg:mt-0">
          <WaitlistForm
            locale={locale}
            from={sourceEvent?.slug ?? null}
            eventHref={sourceEvent?.slug ? `/e/${sourceEvent.slug}` : null}
            defaultRole={defaultRole}
          />
        </div>
      </div>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-xs font-semibold text-mute uppercase tracking-wide">{t.faqTitle}</h2>
        <div className="mt-3 divide-y divide-white/10 rounded-card bg-panel border border-white/10">
          {t.faq.map((item) => (
            <details key={item.q} className="px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{item.q}</summary>
              <p className="text-sm text-mute mt-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {t.instagram}
          </a>
        )}
        <Link href="/events" className="underline underline-offset-4">
          {t.openApp}
        </Link>
      </footer>
    </main>
  );
}
