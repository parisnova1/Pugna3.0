# PUGNA — MASTER Claude Design prompt
Paste this entire prompt into Claude Design.
If `Pugna Mobile.dc.html` is open: APPEND. Do not restyle those 22 frames.
If starting a new file: recreate those 22 first, then add everything below.

Goal: one mobile direction for the whole v1 app so implementation has a single file.

---

## PROMPT

```
Design Pugna mobile (iPhone 390×844, iOS-first / PWA) as one product.

Pugna is the live fight card for amateur combat sports. Boxing first.
Clubs fill the card. Organizers run it. Hall and sofa follow NOW / NEXT.
v1 has NO embedded video. Stream ↗ opens an external URL if set.

VISUAL — Signal Graphite (lock)
Void #0B0C0E · Panel #14161A · Type #F4F1EC · Mute #8A8580
Signal #DC3A2C · onSignal #0B0C0E (dark text on red buttons)
Glass ONLY on top bar, tab bar, sheets, chips
  rgba(20,22,26,0.64) blur 16, 1px rgba(255,255,255,0.10)
Geist. Letter P on a signal tile as mark.
DE UI first. DE|EN on Welcome and Settings.
One primary (signal) button per screen.
No lilac, no cream paper theme, no #0070F3, no pugs, no swords,
no HUD metrics, no fake charts, no extra main tabs.

MAIN TABS (exactly five)
Discover · Events · Clubs · Sparring · You
Sparring tab = public empty “Sparring bald” + hint that clubs post units inside /club.
Do not add Host, Blog, Rangliste, Netzwerk.

ROUTES
/ Welcome (cold start ONLY)
/events  /e/:slug  /go/:code→/e/:slug
/scan
/clubs  /clubs/:id
/fighters/:id
/stories/:slug
/club  /club/nominate  /club/sparring  /club/sparring/new
/host  /host/new  /host/:id  /host/:id/live
/you  /you/noms  /you/notifications
/settings  /settings/legal
/impressum  /datenschutz  /nutzung
/onboarding/role  /onboarding/fields  /account

/e/* and /go/* NEVER show Welcome or onboarding.

==================================================
KEEP / RECREATE (already designed — match existing file)
==================================================
Welcome /
  “Die Karte, live.” “Kampfsport. Boxen zuerst.”
  Events entdecken → /events guest
  Konto erstellen → /onboarding/role
  Anmelden → /account
  DE|EN
  Footer text links: Impressum · Datenschutz · Nutzungsbedingungen

Role / Fields / Account
  Zuschauen · Kämpfer:in · Verein · Veranstalter
  Fields skippable. Viewer skips fields.
  Account: email, Google, Als Gast zu Events.

Events /events
  Chips Alle / Boxen. Cards. QR top-right → /scan.

QR /scan
  Finder. Success → /go/:code.

Live card /e/:slug
  Title, LIVE pill, Share
  NOW · NEXT · list · Follow · Stream ↗ only if stream_url

Share sheet — copy /go/:code + QR

Organizer wizard steps 1–6
  Skeleton → Structure → Entries → Pair → Schedule+intermission → Publish

Live console /host/:id/live
  In progress · Delay · Scratch · Intermission · Next
  “Live auf der öffentlichen Karte”

==================================================
ADD — legal (Germany)
==================================================
Welcome + Account + Settings show:
Impressum · Datenschutz · Nutzungsbedingungen
Max two taps from You tab.

/settings
  Sprache DE|EN
  Mitteilungen toggle
  Rechtliches → /settings/legal
  Konto löschen

/settings/legal
  Impressum · Datenschutz · Nutzungsbedingungen

/impressum /datenschutz /nutzung
  Simple readable legal pages. Placeholder body OK.
  Labels MUST stay German.
  No EU-ODR / OS-Plattform link.

Web-style footer is NOT on every app tab.
Live card: overflow · Rechtliches.

==================================================
ADD — missing v1 sheets
==================================================
Follow gate (event AND club)
  Guest taps Folgen.
  Sheet: Anmelden (signal) or weiter schauen/stöbern (ghost).
  Stay on the card/club. Never Welcome.

Live card Intermission state
  NOW slot = Pause. NEXT still visible.

Live card Stream off vs on
  No URL = no Stream button.

Bout detail /e/:slug/bouts/:id
  Names, weight, clubs or Gast, status. Back to card.

QR denied /scan?denied
  Kamera blockiert. Einstellungen · Code eintippen.

Events empty
  No fake cards. CTA: QR scannen.

==================================================
ADD — fan / viewer Discover
==================================================
Discover tab
  1) Heute / Diese Woche — event cards, LIVE pill → /e/:slug
  2) Vereine — followed clubs (empty CTA → /clubs)
  3) Für Fans — exactly 3 story cards → /stories/:slug
No activity feed, likes, comments, video.

/stories/:slug
  Title, dek, body. Optional Event öffnen. Share.
  No comments.

==================================================
ADD — club discover + public club
==================================================
/clubs
  Search, chips Alle/Boxen.
  Rows: name, city, sport, next night or LIVE, Folgen / Folgst du.

/clubs/:id  (public — fans)
  Name, city, sports
  Folgen
  Nächste Nacht + Karte öffnen → /e/:slug
  Kader preview (few names + kg)
  Offene Einheit row ONLY if posted
  Not the admin dashboard.

==================================================
ADD — club ADMIN /club
==================================================
Four segments: Kader | Events | Sparring | Einstellungen
This is NOT a main tab. Opened from You when hat = Verein.

Kader
  Search, list, checkboxes, + Kämpfer, CSV
  Sticky signal: Zu Event nominieren when selection > 0
  Empty add CTA

/club/fighters/new — name, weight, sport Boxen default

/club/nominate sheet
  Selected names, event picker, weight class, Nominieren

Events segment
  Nights this club is on + Host event → /host/new
  Row → /e/:slug

Sparring segment (club-to-club only)
  Offene Einheit posten → /club/sparring/new
  Own posts + incoming requests Annehmen/Ablehnen
  Empty copy: Clubs bitten hier um Sparring.
  NOT a fighter marketplace.

/club/sparring/new — date, gym, weight window, spots, note

Einstellungen segment
  Name, city, gym, sports, public toggle, fighter invite link, nom notifications

==================================================
ADD — fighter /you
==================================================
When hat = Kämpfer:in

Hero Nächste Bout
  Event, city, weight, opponent or TBA
  Countdown (2T 14STD) OR LIVE
  Zur Karte → /e/:slug
  Empty: Keine nächste Bout

Offene Nominierungen
  Label Event vs Sparring
  Club, weight, date
  Annehmen / Ablehnen

Meine Karten
  Every accepted event/tournament
  Countdown or LIVE → /e/:slug
  Past muted

Bell + badge → /you/notifications

/you/noms — full inbox, chips Alle | Events | Sparring

/you/notifications
  Nom, reminder, T-24h, NOW, Delay, Scratch
  Tap → noms or card

Notify permission sheet once
  “Wenn der Verein dich nominiert oder du dran bist.”
  Erlauben / Nicht jetzt

Sparring nom detail sheet
  Club, gym, date, window, Annehmen / Ablehnen

==================================================
ADD — organizer overview /host
==================================================
When hat = Veranstalter, You shows this home (no extra tab).

Heute Abend hero if a night is today/live
  Title, city, time, LIVE
  Live-Konsole (signal) → /host/:id/live
  Event öffnen → /host/:id
  Optional Teilen
  Tiles: Noms count, Open slots
  + Event erstellen

If nothing tonight: “Keine Nacht heute.” + Event erstellen

List chips: Heute | Entwurf | Vergangen
  Live row → console
  Draft → wizard
  Past muted → public card

Delay sheet — minutes 5/10/15 + note
Scratch sheet — Streichen / Walkover / Ersetzen
Guest fighter sheet — name, club text, weight, “Nicht in der App.”

==================================================
COPY BANK
Die Karte, live. · Kampfsport. Boxen zuerst.
Events entdecken · Konto erstellen · Anmelden
Folgen · Folgst du · Stream ansehen ↗
Live-Konsole · Event öffnen · Event erstellen
Zu Event nominieren · Zur Karte
Sparring bald · Offene Einheit posten
Impressum · Datenschutz · Nutzungsbedingungen
Als Gast zu Events · Überspringen
Live auf der öffentlichen Karte

==================================================
DO NOT DESIGN
Video player, multi-day/multi-ring wizard, paid independent checkout,
ticket gate, NFC writer, sponsor CMS, chat, social feed, rankings,
betting, extra main tabs, cream/lilac theme.

OUTPUT
One mobile file. Frames 390×844 named by route.
Annotate every primary button with destination.
Index page listing all frames grouped:
Onboarding · Fan · Card · Club public · Club admin · Fighter · Organizer · Legal
```

---

## After Design
Implement on `pugna-mobile` only, skin first, bout logic untouched.
Accept test still: publish → scan → NOW → console scratch → card updates.
```
