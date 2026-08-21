import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

type Item = { q: string; a: string; tags: string[] };

const ITEMS: Item[] = [
  {
    q: 'Do participants need an account?',
    a: 'No. Participants open a magic share link (/e/CODE) or type a join code. Only organisers sign in with email and password.',
    tags: ['participants', 'login'],
  },
  {
    q: 'What is a magic share link?',
    a: 'When you create an event, FairSlot generates a unique join code (usually 10 characters). The share link is your site URL plus /e/ plus that code. Anyone with the link can open the live board and claim a slot (subject to PIN, windows, and capacity).',
    tags: ['share', 'link', 'code'],
  },
  {
    q: 'How do I stop overbooking?',
    a: 'Each slot has a capacity. Claims use an atomic update so two people cannot take the last seat. Full slots grey out live via Realtime. You can also lock a single slot or close the whole event.',
    tags: ['capacity', 'slots', 'live'],
  },
  {
    q: 'What does “Lock forever” do?',
    a: 'It freezes the event: no more edits to details, settings, slots, or claims, and the event cannot be deleted through the normal control. You can still export CSV. Use this when the book is final.',
    tags: ['lock', 'immutable'],
  },
  {
    q: 'Can I delete an event?',
    a: 'Yes, from Studio → Book controls → Delete event, if the event is not locked. This removes the event, all slots, and all claims permanently.',
    tags: ['delete'],
  },
  {
    q: 'How do PIN and claim windows work?',
    a: 'In Security settings you can set an access PIN, claim open time, and claim close time. The server enforces these on every claim. The public API never exposes the raw PIN.',
    tags: ['pin', 'security', 'window'],
  },
  {
    q: 'What does “one claim per email” mean?',
    a: 'When enabled, the same email address cannot hold more than one slot on that event. Useful for workshops with limited seats.',
    tags: ['email', 'security'],
  },
  {
    q: 'How do I export attendance?',
    a: 'Open the event in Studio and click Export CSV. You must be signed in. The file includes participant name, email, phone, notes, slot, and timestamp.',
    tags: ['csv', 'export'],
  },
  {
    q: 'Why is my share link invalid?',
    a: 'Check you copied the full /e/CODE path, that the event still exists, and that you did not regenerate the magic code (regenerating invalidates the old link). Codes are case-insensitive.',
    tags: ['share', 'error'],
  },
  {
    q: 'Draft vs live vs closed?',
    a: 'Draft: not open for public claims. Live: participants can claim (if windows/PIN allow). Closed: claims rejected, but the event still exists for export and review. You can move between these until the event is locked.',
    tags: ['status', 'live', 'draft'],
  },
  {
    q: 'What is bulk paste for slots?',
    a: 'In Studio inventory, choose Bulk paste and enter one slot per line: Name, capacity, category. Example: “Morning lab, 12, Lab”. Up to 40 lines at once.',
    tags: ['slots', 'bulk'],
  },
  {
    q: 'Where do I change my password?',
    a: 'Open Account settings from the avatar menu or hamburger menu. You can update password and email there.',
    tags: ['account', 'password'],
  },
  {
    q: 'Is data public?',
    a: 'Event titles and slot inventory can be read for live boards. Claims (names, emails, phones) are not world-readable; organisers see them in Studio. Join PINs are never sent to the browser in full.',
    tags: ['privacy', 'security'],
  },
  {
    q: 'Can I duplicate an event?',
    a: 'Yes. In Studio book controls, Duplicate creates a draft copy with the same settings and slots (empty claims) and a new magic code.',
    tags: ['duplicate'],
  },
];

export default function Faq() {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(0);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ITEMS;
    return ITEMS.filter(
      (it) =>
        it.q.toLowerCase().includes(s) ||
        it.a.toLowerCase().includes(s) ||
        it.tags.some((t) => t.includes(s))
    );
  }, [q]);

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-sage">Help</p>
        <h1 className="mt-2 font-display text-4xl">FAQ</h1>
        <p className="mt-3 text-sm text-ink-soft/70">
          Short answers for organisers and participants. For a full walkthrough, see the{' '}
          <Link to="/guide" className="text-moss underline decoration-gold/50 underline-offset-2">
            Creator guide
          </Link>
          .
        </p>

        <div className="relative mt-8">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            className="input-field pl-9"
            placeholder="Search FAQ…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-6 space-y-2">
          {filtered.length === 0 && (
            <p className="rounded-2xl bg-cream p-5 text-sm text-ink-soft/60 ring-1 ring-ink/6">No matches.</p>
          )}
          {filtered.map((it, idx) => {
            const open = openId === idx;
            return (
              <div key={it.q} className="overflow-hidden rounded-2xl bg-cream ring-1 ring-ink/6">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  onClick={() => setOpenId(open ? null : idx)}
                  aria-expanded={open}
                >
                  <span className="font-medium text-ink">{it.q}</span>
                  <ChevronDown size={18} className={`shrink-0 text-ink/40 transition ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && <div className="border-t border-ink/6 px-5 py-4 text-sm leading-relaxed text-ink-soft/80">{it.a}</div>}
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
