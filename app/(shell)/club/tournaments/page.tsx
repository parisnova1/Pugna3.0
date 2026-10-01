import { redirect } from "next/navigation";

/** Renamed to /club/organizer as part of the 6-section Club redesign. */
export default async function ClubTournamentsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { club } = await searchParams;
  redirect(club ? `/club/organizer?club=${club}` : "/club/organizer");
}
