# Claude Design prompt — Pugna mobile v1
Live app to improve: https://pugna-mobile-app.vercel.app  
Target look: existing file `Pugna Mobile.dc.html` (Signal Graphite).  
Scope: **v1 only**. No video player, no sparring marketplace, no multi-day, no paid independent.

Design **only mobile 390×844**. Restyle + fill missing v1 sheets. Do not invent v2.

---

## What production is today (problems)

Splash `/` (also paints on `/events` — bug)
- Black screen, grid-ring mark, wordmark “Pugna”
- Line: “Events, Brackets, Sparring — ohne Excel.”
- Pill: **Loslegen**
- Link: Schon ein Konto? Anmelden
- No guest “Events entdecken”
- No DE|EN on this frame
- No letter-P signal tile

`/persona`
- “Wie nutzt du Pugna?”
- Roles: Zuschauer, Kämpfer, Veranstalter, Verein (order wrong vs target)
- Subcopy still says Live-Brackets / Sparring hosten
- Weiter is a ghost pill, no signal red
- 3-dot progress (old 6-step leftover)

HTML snapshot of marketing-ish home also mentions:
- DACH · Boxen · Kickboxen · MMA · BJJ
- Veranstaltungen / Vereine / Sparring
- Event-QR-Code scannen
- Demnächst in deiner Nähe
- Bei Pugna registrieren
List content is thin/empty.

Gaps vs locked design + v1 spec
1. Wrong first paint (Excel/brackets pitch, not “Die Karte, live.”)
2. `/events` and likely `/e/:slug` still hit Welcome
3. No Signal Graphite (no #DC3A2C CTA, no #0B0C0E + panel system as designed)
4. No guest path into the catalog
5. Onboarding still feels like the old long flow
6. No NOW/NEXT live-card frame in production first paint
7. Missing v1 sheets listed below
8. Copy talks brackets/sparring before the card exists
9. Role order and labels (Zuschauer vs Zuschauen, Club last)
10. Empty events — no designed empty state
11. QR exists in copy, no designed camera / permission-deny
12. Follow / Stream ↗ not visible as product chrome

---

## PROMPT (paste into Claude Design)

```
Design missing + improved v1 screens for Pugna mobile (390×844).
Match the existing Pugna Mobile.dc.html file exactly:
Void #0B0C0E, Panel #14161A, Type #F4F1EC, Mute #8A8580,
Signal #DC3A2C, onSignal #0B0C0E, glass only on bars/chips/sheets.
Geist. Letter P on a signal tile. DE first, DE|EN on Welcome + Settings.
No lilac, no cream, no #0070F3, no pug, no video player, no HUD metrics.

Production to replace (do not copy):
https://pugna-mobile-app.vercel.app
— splash “Events, Brackets, Sparring — ohne Excel.” + Loslegen
— /events currently shows that same splash (must NOT)
— /persona ghost buttons, “Live-Brackets”, role order Zuschauer/Kämpfer/Veranstalter/Verein

Improve every live feature:

1. Welcome /
Replace splash. Headline “Die Karte, live.” Sub “Kampfsport. Boxen zuerst.”
Primary: Events entdecken → /events guest
Konto erstellen → /onboarding/role
Anmelden → /account
DE|EN
Delete “ohne Excel” and Loslegen as the only CTA.

2. Role
Zuschauen / Kämpfer:in / Verein / Veranstalter
Weiter signal red. 2/3 max. No brackets/sparring promises.

3. Fields (optional, skip)
City / club / weight as needed. Überspringen.

4. Account
Email, Google, Als Gast zu Events.

5. Events /events
Must render WITHOUT welcome.
Chips Alle / Boxen. Cards. QR top-right.
Empty state: “Noch keine Events in der Nähe” + QR + Discover later.

6. QR camera + permission deny
Scan /go/:code. Denied: open settings / paste code.

7. Live card /e/:slug
NOW, NEXT, list, statuses, Follow, Stream ↗ only if URL, Share.
Intermission state (pause, no names as NOW).
Guest Follow → login sheet (stay on card after).

8. Share sheet
/go/:code + QR image.

9. Discover tab
Followed cards + nearby. Not a second Events clone.

10. Fighter home
Next bout, Annehmen / Ablehnen nomination, open card.

11. Nomination inbox
List pending noms with accept/decline.

12. Club
Roster, add, CSV, checkboxes, Zu Event nominieren sheet (event + weight),
Host event.

13. Clubs directory + public club profile

14. Public fighter mini-profile
Name, club, weight, last bouts placeholder.

15. Organizer home
Heute Abend, Live-Konsole, Event öffnen, Event erstellen.

16. Wizard chrome
Skeleton → Structure → Entries (noms + guest fighter + CSV) → Pair →
Schedule + intermission → Publish.

17. Guest fighter sheet
Name, club text, weight. Not in the app.

18. Live console
In progress, Delay (minutes sheet), Scratch (scratch/walkover/replace),
Intermission, Next. “Live auf der öffentlichen Karte.”

19. Bout row detail
Clubs, weight, status. Back to card.

20. Sparring tab
Empty “Sparring bald” only.

21. You + Settings
Role, language, notify on/off for followed cards, logout.

22. Notify toggle
Required for Follow to mean something.

Annotate each primary button with destination route.
/e/* and /go/* never show Welcome.
Same backend events as web. Placeholder DE names OK.
v1 only — no video, multi-day, multi-ring, paid independent, sparring board.
```

---

## Priority order for frames
1. Welcome + Events (kill splash-on-/events)
2. Live card + Intermission + Follow gate + Stream ↗ on/off
3. QR + permission deny
4. Console + Delay/Scratch sheets
5. Club nominate + guest fighter
6. Fighter home + nom inbox
7. Empty states + settings notify
