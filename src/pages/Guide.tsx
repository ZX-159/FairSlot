import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const sections = [
  {
    id: 'overview',
    title: '1. Big picture',
    body: [
      'FairSlot has two sides: organisers (you) and participants (students, volunteers, parents).',
      'You sign in once, create events, add slots with capacity, go live, and share a magic link. Participants never create accounts.',
      'Live inventory updates for everyone looking at the board. Claims are atomic so the last seat cannot be double-booked.',
    ],
  },
  {
    id: 'studio',
    title: '2. Studio dashboard',
    body: [
      'Open Studio from the menu. You will see fill stats, recent claims, and all your events.',
      'Use search and filters (Live / Draft / Closed / Locked) to find a book quickly.',
      'Refresh reloads data from the server. Click an event card to open its studio page.',
      'Quick actions: New event, Account settings (avatar or hamburger), Creator guide, FAQ.',
    ],
  },
  {
    id: 'create',
    title: '3. Creating an event (composer)',
    body: [
      'Path: New event. Work top to bottom — the form is ordered on purpose.',
      'Basics: title (required), description, location, date & time, category, cover image.',
      'Publishing: choose Draft (hidden from claims) or Go live (open when saved).',
      'Optional starter slots: add a few lines before create so the board is not empty on day one.',
      'Security & notices: PIN, one-per-email, claim windows, pre-notice text, success/ticket copy.',
      'On create, FairSlot assigns a magic join code and opens the event studio.',
    ],
  },
  {
    id: 'share',
    title: '4. Sharing with participants',
    body: [
      'In the event studio, copy the magic share link or the join code.',
      'Preview opens the participant page. QR code is printable for posters or slides.',
      '“New code” regenerates the magic link — old links stop working. Use if a link leaked.',
      'Unlisted events stay off the public directory but still work via link/code.',
    ],
  },
  {
    id: 'slots',
    title: '5. Inventory (slots)',
    body: [
      'Slots are the claimable units: sessions, shifts, tables, rooms, time blocks.',
      'Each has name, optional description, category, and capacity.',
      'Add one slot at a time, or Bulk paste: Name, capacity, category per line.',
      'Lock a single slot to stop new claims without freezing the whole event.',
      'Delete a slot only if you accept removing its claims too.',
    ],
  },
  {
    id: 'claims',
    title: '6. Claims & export',
    body: [
      'Claims appear live in the studio list. You can remove a claim (if not locked) to free a seat.',
      'Export CSV downloads attendance for spreadsheets or registers.',
      'Participants get a receipt page and can download a PNG ticket.',
    ],
  },
  {
    id: 'controls',
    title: '7. Book controls',
    body: [
      'Go live / Close claims / Back to draft: control whether new claims are accepted.',
      'Duplicate: draft copy with slots and settings, fresh magic code, no claims.',
      'Lock forever: irreversible freeze for a final book (export still works).',
      'Delete event: permanent removal of event, slots, and claims (not when locked).',
    ],
  },
  {
    id: 'security',
    title: '8. Security settings explained',
    body: [
      'Access PIN: participants must enter it after opening the link.',
      'Require phone / confirm email / one claim per email: form rules enforced on the server.',
      'Hide remaining counts: public UI shows Open/Full only.',
      'Claim open/close: time window for claims.',
      'Pre-notice + acknowledgement: show instructions before the board.',
      'Allow notes / maps link: optional participant UX toggles.',
      'Success title, message, ticket footnote: customise the receipt and PNG ticket.',
    ],
  },
  {
    id: 'account',
    title: '9. Account settings',
    body: [
      'Change email or password from Account settings in the menu.',
      'Sign out from the avatar menu, hamburger menu, or account page.',
      'Keep organiser credentials private — they unlock exports and deletes.',
    ],
  },
  {
    id: 'checklist',
    title: '10. Day-of checklist',
    body: [
      '1) Event is Live, not Draft/Closed.',
      '2) Slots and capacities look right; optional PIN shared with the room.',
      '3) Magic link / QR posted; test once in a private browser window.',
      '4) Watch Studio fill rates; export CSV when done.',
      '5) Lock forever if the book should not change again.',
    ],
  },
];

export default function Guide() {
  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-sage">Tutorial</p>
        <h1 className="mt-2 font-display text-4xl">Creator guide</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
          Plain-language walkthrough of every major organiser function. For short Q&amp;A, see the{' '}
          <Link to="/faq" className="text-moss underline decoration-gold/50 underline-offset-2">
            FAQ
          </Link>
          . Ready to build?{' '}
          <Link to="/events/new" className="text-moss underline decoration-gold/50 underline-offset-2">
            Create an event
          </Link>{' '}
          or open{' '}
          <Link to="/dashboard" className="text-moss underline decoration-gold/50 underline-offset-2">
            Studio
          </Link>
          .
        </p>

        <nav className="mt-8 rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
          <p className="text-[11px] uppercase tracking-wider text-sage">On this page</p>
          <ol className="mt-3 columns-1 gap-x-8 space-y-1.5 text-sm sm:columns-2">
            {sections.map((s) => (
              <li key={s.id} className="break-inside-avoid">
                <a href={`#${s.id}`} className="text-ink/80 hover:text-moss">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="font-display text-2xl">{s.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-soft/80">
                {s.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-[2rem] bg-ink p-6 text-cream md:p-8">
          <h2 className="font-display text-2xl">Need the short version?</h2>
          <p className="mt-2 text-sm text-cream/70">
            Create → add slots → go live → share magic link → watch inventory → export CSV → lock when final.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/events/new" className="rounded-full bg-cream px-4 py-2 text-sm text-ink">
              New event
            </Link>
            <Link to="/faq" className="rounded-full border border-cream/25 px-4 py-2 text-sm">
              FAQ
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
