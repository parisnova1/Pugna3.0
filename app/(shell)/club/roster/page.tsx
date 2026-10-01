import { redirect } from "next/navigation";

/** Renamed to /club/fighters as part of the 6-section Club redesign. */
export default async function ClubRosterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { club } = await searchParams;
  redirect(club ? `/club/fighters?club=${club}` : "/club/fighters");
}
