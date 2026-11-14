import { buttonClass } from "@/components/ui/Button";
import { clearPrefs, dismissPrefs, savePrefs } from "@/lib/actions/prefs";
import { MAX_CITY_LENGTH, PREF_SPORTS, hasPrefs, type Prefs } from "@/lib/prefs";

/**
 * Optional "show me what I care about" control for the events list. Shown open
 * until the visitor saves or declines, then it shrinks to a one-line summary
 * with an Edit/Clear option. Browsing never depends on it.
 */
export function PersonalizeCard({ prefs, returnTo }: { prefs: Prefs; returnTo: string }) {
  const active = hasPrefs(prefs);
  if (prefs.dismissed && !active) return null;

  const summary = [...prefs.sports, prefs.city].filter(Boolean).join(" · ");

  const form = (
    <form action={savePrefs} className="space-y-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-ink">Sports you follow</legend>
        <div className="flex flex-wrap gap-2">
          {PREF_SPORTS.map((sport) => (
            <label key={sport} className="cursor-pointer">
              <input
                type="checkbox"
                name="sport"
                value={sport}
                defaultChecked={prefs.sports.includes(sport)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-pill border border-white/15 px-4 py-2 text-sm font-medium text-mute peer-checked:bg-ink peer-checked:text-void peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                {sport}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="pref-city" className="block text-sm font-medium text-ink">
          Your city <span className="font-normal text-mute">(optional)</span>
        </label>
        <input
          id="pref-city"
          name="city"
          type="text"
          autoComplete="address-level2"
          maxLength={MAX_CITY_LENGTH}
          defaultValue={prefs.city}
          placeholder="e.g. Munich"
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute"
        />
        <p className="text-xs text-mute">Typed by you. We never ask for your location.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={buttonClass({ size: "xs", text: "sm", className: "px-5" })}>
          Save
        </button>
        {!active && (
          <button
            type="submit"
            formAction={dismissPrefs}
            formNoValidate
            className={buttonClass({ variant: "outline", size: "xs", text: "sm", className: "px-5" })}
          >
            No thanks
          </button>
        )}
      </div>
    </form>
  );

  if (!active) {
    return (
      <section aria-label="Personalize events" className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">Show what you care about first</p>
          <p className="text-xs text-mute">
            Optional. Nothing is hidden: events matching your picks just come first. Saved on this device only.
          </p>
        </div>
        {form}
      </section>
    );
  }

  return (
    <section aria-label="Personalize events" className="rounded-card bg-panel border border-white/10 px-4 py-3">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm">
          <span className="text-ink">
            <span className="text-mute">Your picks first: </span>
            {summary}
          </span>
          <span className="shrink-0 font-medium text-signal-ink">Edit</span>
        </summary>
        <div className="mt-4 space-y-3">
          {form}
          <form action={clearPrefs}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <button type="submit" className="text-sm font-medium text-mute underline">
              Clear my picks
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}
