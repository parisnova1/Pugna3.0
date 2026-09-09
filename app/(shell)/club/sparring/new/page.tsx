import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { createSparringPost } from "@/lib/actions/sparring";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function NewSparringPostPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/sparring/new");
  const clubId = actor.clubIds[0];
  if (!clubId) redirect("/club");

  return (
    <div className="space-y-6 pt-2">
      <BackButton />
      <h1 className="text-2xl font-semibold">Post a sparring session</h1>

      <ActionForm action={createSparringPost} submitLabel="Post session" className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <input name="gym" placeholder="Gym" required className={inputClass} />
        <input name="date" type="datetime-local" required className={inputClass} />
        <input name="weightWindow" placeholder="Weight window (e.g. 65-75kg)" required className={inputClass} />
        <input name="spots" type="number" min={1} defaultValue={1} placeholder="Spots" className={inputClass} />
        <textarea name="note" placeholder="Note (optional)" rows={3} className={inputClass} />
      </ActionForm>
    </div>
  );
}
