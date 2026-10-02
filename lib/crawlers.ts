/**
 * Search-engine crawlers and link-preview fetchers (WhatsApp, Slack, Discord,
 * iMessage, etc.) never carry the onboarding cookie, so the first-visit gate
 * would redirect every public URL they request to /onboarding -- making the
 * whole site unindexable and every shared link unfurl as the splash screen.
 * They get the real page instead; a human on the same URL still hits the gate.
 */
const CRAWLER_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|embedly|whatsapp|telegram|discord|slack|linkedin|pinterest|skype|ia_archiver|lighthouse|pagespeed|headlesschrome|preview/i;

export function isCrawler(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && CRAWLER_PATTERN.test(userAgent));
}
