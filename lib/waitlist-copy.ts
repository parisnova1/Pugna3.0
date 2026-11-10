import type { WaitlistLocale, WaitlistRoleValue } from "@/lib/waitlist";

type Copy = {
  eyebrow: string;
  title: string;
  lead: string;
  points: { title: string; body: string }[];
  formTitle: string;
  roleLabel: string;
  roles: Record<WaitlistRoleValue, string>;
  email: string;
  name: string;
  namePlaceholder: string;
  club: string;
  clubPlaceholder: string;
  city: string;
  cityPlaceholder: string;
  newsletter: string;
  consent: string;
  submit: string;
  submitting: string;
  doneTitle: string;
  doneBody: string;
  errors: { email: string; consent: string; form: string; rate: string };
  faqTitle: string;
  faq: { q: string; a: string }[];
  instagram: string;
  openApp: string;
  backToEvent: string;
  otherLanguage: string;
};

export const WAITLIST_COPY: Record<WaitlistLocale, Copy> = {
  en: {
    eyebrow: "Pugna · waiting list",
    title: "Every fight, live on your phone.",
    lead: "Pugna shows the fight card, the schedule, live results and brackets for combat sports events. We are testing it at events now. Leave your email and you hear first when it opens for your club.",
    points: [
      { title: "For the audience", body: "Scan the code in the hall, see who fights next and who won, and vote for the fight of the day." },
      { title: "For coaches", body: "Enter your fighters, see who they face and when they are up, and follow results ring by ring." },
      { title: "For organizers", body: "Build the card, run it from ringside, and every screen in the hall updates as you go." },
    ],
    formTitle: "Join the waiting list",
    roleLabel: "I am a",
    roles: { FAN: "Fan", COACH: "Coach", FIGHTER: "Fighter", ORGANIZER: "Organizer" },
    email: "Email",
    name: "Name",
    namePlaceholder: "Optional",
    club: "Club",
    clubPlaceholder: "Your club or gym",
    city: "City",
    cityPlaceholder: "Optional",
    newsletter: "Also send me the Pugna newsletter with event news.",
    consent: "Pugna may store my details and email me about the launch. I can ask for them to be deleted at any time.",
    submit: "Join the waiting list",
    submitting: "Saving…",
    doneTitle: "You are on the list.",
    doneBody: "We will email you when Pugna opens. Until then, follow the event live.",
    errors: {
      email: "Enter a valid email address.",
      consent: "Tick the box so we are allowed to email you.",
      form: "That did not save. Try again in a moment.",
      rate: "Too many attempts from here. Try again in a few minutes.",
    },
    faqTitle: "Questions",
    faq: [
      { q: "What is Pugna?", a: "A web app for combat sports events. It shows the fight card, the running order, live results and brackets, and updates while the event runs." },
      { q: "Does following an event cost anything?", a: "No. Following an event, the live results and the livestream link are free." },
      { q: "Do I need an account to follow an event or vote?", a: "No. Scan the QR code or type the event code and you are in. Voting for the fight of the day works without an account, one vote per person and day." },
      { q: "When can my club use Pugna?", a: "There is no public date yet. We are running test events first. People on the waiting list are told before anyone else." },
      { q: "What happens with my email?", a: "We use it to tell you about the launch, and for the newsletter only if you ticked that box. We do not pass it on. Ask us and we delete it." },
    ],
    instagram: "Pugna on Instagram",
    openApp: "Open Pugna",
    backToEvent: "Back to the event",
    otherLanguage: "Deutsch",
  },
  de: {
    eyebrow: "Pugna · Warteliste",
    title: "Jeder Kampf, live auf deinem Handy.",
    lead: "Pugna zeigt Fight Card, Zeitplan, Live-Ergebnisse und Turnierbäume von Kampfsport-Events. Wir testen die App gerade auf Veranstaltungen. Trag dich ein und du erfährst als Erstes, wann sie für deinen Verein startet.",
    points: [
      { title: "Für Zuschauer", body: "Code in der Halle scannen, sehen, wer als Nächstes kämpft und wer gewonnen hat, und für den Kampf des Tages abstimmen." },
      { title: "Für Trainer", body: "Kämpfer melden, sehen, gegen wen und wann sie dran sind, und Ergebnisse Ring für Ring verfolgen." },
      { title: "Für Veranstalter", body: "Fight Card bauen, am Ring steuern, und jeder Bildschirm in der Halle zieht sofort mit." },
    ],
    formTitle: "Auf die Warteliste",
    roleLabel: "Ich bin",
    roles: { FAN: "Fan", COACH: "Trainer", FIGHTER: "Kämpfer", ORGANIZER: "Veranstalter" },
    email: "E-Mail",
    name: "Name",
    namePlaceholder: "Optional",
    club: "Verein",
    clubPlaceholder: "Dein Verein oder Gym",
    city: "Ort",
    cityPlaceholder: "Optional",
    newsletter: "Schickt mir auch den Pugna-Newsletter mit Event-News.",
    consent: "Pugna darf meine Angaben speichern und mir zum Start schreiben. Ich kann die Löschung jederzeit verlangen.",
    submit: "Auf die Warteliste",
    submitting: "Speichern…",
    doneTitle: "Du stehst auf der Liste.",
    doneBody: "Wir schreiben dir, sobald Pugna startet. Bis dahin: Verfolge das Event live.",
    errors: {
      email: "Gib eine gültige E-Mail-Adresse ein.",
      consent: "Setz das Häkchen, damit wir dir schreiben dürfen.",
      form: "Das hat nicht geklappt. Versuch es gleich noch einmal.",
      rate: "Zu viele Versuche von hier. Versuch es in ein paar Minuten noch einmal.",
    },
    faqTitle: "Fragen",
    faq: [
      { q: "Was ist Pugna?", a: "Eine Web-App für Kampfsport-Events. Sie zeigt Fight Card, Reihenfolge, Live-Ergebnisse und Turnierbäume und aktualisiert sich, während das Event läuft." },
      { q: "Kostet es etwas, einem Event zu folgen?", a: "Nein. Event folgen, Live-Ergebnisse und der Link zum Livestream sind kostenlos." },
      { q: "Brauche ich ein Konto, um zu folgen oder abzustimmen?", a: "Nein. QR-Code scannen oder Event-Code eingeben, fertig. Die Abstimmung zum Kampf des Tages geht ohne Konto, eine Stimme pro Person und Tag." },
      { q: "Ab wann kann mein Verein Pugna nutzen?", a: "Ein öffentliches Datum gibt es noch nicht. Zuerst laufen Test-Events. Wer auf der Warteliste steht, erfährt es vor allen anderen." },
      { q: "Was passiert mit meiner E-Mail?", a: "Wir nutzen sie, um dich über den Start zu informieren, und für den Newsletter nur, wenn du das Häkchen gesetzt hast. Wir geben sie nicht weiter. Auf Wunsch löschen wir sie." },
    ],
    instagram: "Pugna auf Instagram",
    openApp: "Pugna öffnen",
    backToEvent: "Zurück zum Event",
    otherLanguage: "English",
  },
};
