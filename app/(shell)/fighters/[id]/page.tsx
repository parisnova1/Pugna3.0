import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function FighterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const fighter = await prisma.fighterProfile.findUnique({
    where: { id },
    include: { club: true },
  });

  if (!fighter) notFound();

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">{fighter.displayName}</h1>
      <p className="text-mute text-sm">
        {fighter.club?.name ?? "Independent"} {fighter.weightClass ? `· ${fighter.weightClass}` : ""}
      </p>
    </div>
  );
}
