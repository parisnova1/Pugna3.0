import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const clubs = await prisma.club.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { name: "asc" },
    include: { _count: { select: { roster: true } } },
    take: 40,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold pt-2">Clubs</h1>

      <form className="relative">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search clubs"
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute"
        />
      </form>

      {clubs.length === 0 ? (
        <p className="text-mute text-sm text-center py-10">No clubs found.</p>
      ) : (
        <div className="space-y-2">
          {clubs.map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
            >
              <div>
                <p className="font-medium">{club.name}</p>
                <p className="text-xs text-mute mt-0.5">{club.city ?? "—"} · {club._count.roster} fighters</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
