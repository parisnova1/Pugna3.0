import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { createSparringSession } from "@/lib/actions/sparring";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";
const SPORTS = ["Boxing", "Kickboxing", "MMA"];
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro", "All levels"];

export default async function NewSparringSessionPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/sparring/host/new");
  if (actor.clubIds.length === 0) redirect("/sparring/host");

  const clubs = await prisma.club.findMany({ where: { id: { in: actor.clubIds } } });

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Open sparring</h1>

      <ActionForm action={createSparringSession} submitLabel="Publish" className="space-y-3">
        {clubs.length > 1 ? (
          <select name="clubId" className={inputClass}>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <input type="hidden" name="clubId" value={clubs[0]!.id} />
        )}
        <select name="accessMode" defaultValue="OPEN_TO_CLUBS" className={inputClass}>
          <option value="OPEN_TO_CLUBS">Open to clubs — any club can request in, then nominate</option>
          <option value="INVITE">Invite — only clubs you pick</option>
          <option value="OPEN">Open sparring — any fighter can request a slot directly</option>
        </select>
        <select name="sport" defaultValue="Boxing" className={inputClass}>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input name="gym" placeholder="Gym" required className={inputClass} />
        <input name="city" placeholder="City" className={inputClass} />
        <input name="date" type="datetime-local" required className={inputClass} />
        <input name="weightGroups" placeholder="Weight groups (comma-separated, e.g. 65-70kg, 70-75kg)" className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input name="minAge" type="number" min={0} placeholder="Min age" className={inputClass} />
          <input name="maxAge" type="number" min={0} placeholder="Max age" className={inputClass} />
        </div>
        <select name="sex" defaultValue="" className={inputClass}>
          <option value="">Any sex</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <select name="experienceLevel" defaultValue="" className={inputClass}>
          <option value="">Any experience</option>
          {EXPERIENCE_LEVELS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <textarea name="rulesText" placeholder="Rules (e.g. 3x2min, 1min rest, 16oz gloves, headgear optional)" rows={3} className={inputClass} />
      </ActionForm>
    </div>
  );
}
