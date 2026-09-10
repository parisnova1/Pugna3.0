# PUGNA Sparring — Club-to-club ecosystem

Version: 1.2  
Status: Replaces marketplace-default sparring  
Scope: Sparring only. Do not touch competition Event / Bout / Live Console.

---

## Intent

Sparring is a **club ecosystem**, not an individual fighter marketplace.

A club admin nominates fighters from **their roster**. The other club **accepts**.  
A host club chooses who may enter the session:

| Mode | Who can enter | Club nomination required |
|---|---|---|
| **Invite** | Only clubs the host invites | Yes |
| **Open to clubs** | Any claimed club on PUGNA | Yes |
| **Open sparring** | Any registered fighter on the app | No — fighter self-requests |

Default for new sessions: **Open to clubs**.  
Open sparring is an explicit choice, not the product default.

Cross-club pairing is still allowed after both sides have accepted. That is matching, not discovery.

---

## Hats

- **Club Hat** owns session create, invite, nominate, accept/decline.
- **Fighter Hat** sees “you’re nominated / confirmed / matched”, can accept/decline a nomination, can self-request only when mode is Open sparring.
- **Organizer Hat** is not required. No `/host` live console for sparring.
- Sparring data never writes `Event` / `Bout` competition rows.

---

## Access modes

### INVITE

1. Host club creates session, sets mode Invite, picks clubs.
2. Each invited club gets a request: `{Host club} invited you to spar · {date} · {venue}`.
3. Guest club admin **Accepts** or **Declines** the invite.
4. On accept, guest club nominates fighters from roster (by weight group / slots).
5. Host club **Accepts** or **Declines** each nomination (or the batch).
6. Accepted fighters are CONFIRMED on the session (fighter may still confirm if you keep fighter-ack).
7. Host pairs CONFIRMED fighters (including across clubs).

Uninvited clubs do not see the session in Discover. Uninvited fighters cannot join.

### OPEN TO CLUBS

1. Host club creates session, mode Open to clubs.
2. Session appears in Club Discover / Sparring board for other club admins.
3. Guest club **Requests to join** (club-level).
4. Host **Accepts** or **Declines** that club.
5. Then same nominate → host accept-nomination chain as Invite.

Individual fighters without a club cannot join this mode.

### OPEN SPARRING

1. Host club creates session, mode Open sparring.
2. Any registered fighter (Fighter Hat) can request a slot at `/sparring/:id`.
3. Host accepts/declines the fighter request.
4. Pairing proceeds among CONFIRMED participants.

This preserves the production path you already tested (Taylor Cross joining Golden Gate). It is **opt-in per session**, not the architecture.

---

## Objects

```
SparringSession
  hostClubId
  title, venue, date, startTime
  accessMode: INVITE | OPEN_TO_CLUBS | OPEN
  status: DRAFT | OPEN | LOCKED | DONE | CANCELLED
  weightGroups[{ label, minKg?, maxKg?, capacity? }]
  notes?

SparringClubInvite          // INVITE
  sessionId, clubId
  status: PENDING | ACCEPTED | DECLINED | EXPIRED

SparringClubRequest         // OPEN_TO_CLUBS
  sessionId, clubId
  status: PENDING | ACCEPTED | DECLINED | EXPIRED

SparringNomination          // club roster path
  sessionId, clubId, fighterId, weightGroupId
  status: PENDING | ACCEPTED | DECLINED | WITHDRAWN
  nominatedByUserId

SparringEntry               // resulting participant
  sessionId, fighterId, clubId?, source: NOMINATION | OPEN_REQUEST
  status: REQUESTED | CONFIRMED | WAITLIST | DECLINED | WITHDRAWN

SparringMatch
  sessionId
  fighterAId, fighterBId
  status: PROPOSED | CONFIRMED | CANCELLED
```

Rule: a fighter from Club B only reaches CONFIRMED on an Invite / Open-to-clubs session via:

`club accepted onto session → nomination from that club’s roster → host accepted nomination`

Do not let a Club B fighter self-join those modes.

---

## Club admin flows

### Host club (`/club/sparring`)

- Create session + access mode
- Invite clubs (Invite mode)
- Inbox: club requests, nominations, open-fighter requests
- Accept / decline
- Suggested matches only among CONFIRMED entries
- Confirm pair → notify both fighters

### Guest club (`/club/sparring` + `/club/events` style list)

- Discover sessions that are Open to clubs, plus Invites
- Accept invite or Request to join
- Nominate from roster
- See host accept/decline per fighter
- Cannot pair, cannot operate another club’s session

Empty copy:

- No sessions: Create session / Discover clubs
- Invite pending: Accept invite
- Accepted, no noms: Nominate fighters

---

## Fighter flows

Invite / Open to clubs:

- Notification: `{Club} nominated you for sparring at {session}`
- `/you/noms` or sparring noms: Accept / Decline
- After host + fighter confirm: “You’re confirmed for sparring…”
- After pair: “You’ve been matched with {name} at {venue}”

Open sparring:

- Fighter finds session → Request to join → host accepts → same confirm/match notifications

`/you` Next card can show the next sparring session. Still not a social feed.

---

## Notifications

| Trigger | Who |
|---|---|
| Club invited | Guest club admins |
| Club requested to join | Host club admins |
| Club accepted / declined | Other club’s admins |
| Fighter nominated | Fighter |
| Nomination accepted / declined | Fighter + nominating club |
| Open request accepted | Fighter |
| Match confirmed | Both fighters + both clubs |

---

## Permissions

| Action | Guest | Fighter | Guest club admin | Host club admin |
|---|---|---|---|---|
| View OPEN session | if published | yes | yes | yes |
| View INVITE session | no | only if nominated/confirmed | only if invited | yes |
| Request slot (OPEN) | no | yes | — | — |
| Request club join (OPEN_TO_CLUBS) | no | no | yes | — |
| Nominate roster | no | no | yes, own roster | yes, own roster |
| Accept club / nomination | no | no | no | yes |
| Pair / confirm match | no | no | no | yes |

Claimed-club rule still applies. No stolen clubs. Host membership of a *competition event* is irrelevant here.

---

## What to change in production

Current production is marketplace-first: any fighter joins any open session; host matches across clubs with no club-accept gate.

Change:

1. Add `accessMode` to session create. Default `OPEN_TO_CLUBS`.
2. Add club invite + club request + nomination tables.
3. Suggested Matches may only include CONFIRMED entries that passed the gate for that mode.
4. Keep Open sparring as the third mode so existing Taylor Cross–style tests still work when the host picks Open.
5. Club dashboard lists **Hosting** vs **Invited / Requests**, same split as events.
6. Do not route sparring through `/host` or competition bouts.

---

## Acceptance

Invite
- Club A invites Club B. B cannot nominate before accepting.
- B nominates Taylor from B’s roster. A accepts. Taylor is CONFIRMED.
- Uninvited Club C does not see the session.

Open to clubs
- Club B requests in. A accepts club. B nominates. A accepts noms. Pairing allowed.
- A lone fighter with no club cannot join.

Open
- Taylor (Iron Fist) can still request Golden Gate’s session without a club invite.
- Host accept → confirm → match notifications unchanged.

Pairing
- Sam (Golden Gate) × Taylor (Iron Fist) is valid **after** both are CONFIRMED under the session’s mode.
- Suggested match never proposes a fighter who is only REQUESTED.
