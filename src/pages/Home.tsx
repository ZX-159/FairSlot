import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, Radio, FileSpreadsheet, Sparkles, MessageCircle, Table2, ClipboardList } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EventCard from '../components/EventCard';
import LiveDot from '../components/LiveDot';
import type { EventRecord } from '../lib/types';

const fade = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/public');
        const data = await res.json();
        setEvents(Array.isArray(data) ? data.slice(0, 3) : []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 4) navigate(`/e/${c}`);
  };

  return (
    <div className="min-h-screen bg-parchment text-ink">
      <Navbar />
      <section className="relative overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-leaf/15 blur-3xl" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-12 md:px-8 md:pt-16">
          <motion.div className="md:col-span-6" initial="hidden" animate="show" variants={fade}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink/8 bg-cream/70 px-3 py-1.5 backdrop-blur">
              <LiveDot label="Realtime" />
              <span className="text-xs text-ink-soft/70">Live inventory for any gathering</span>
            </div>
            <h1 className="font-display text-[2.7rem] leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Fair slots.
              <span className="block italic text-moss"> Instantly.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-soft/80 sm:text-lg">
              Replace group chats, forms and shared sheets with live inventory, immutable locking, and a tidy export — for workshops, shifts, conferences and sign-ups.
            </p>
            <form onSubmit={join} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter join code"
                className="input-field font-mono tracking-[0.2em] uppercase sm:max-w-[220px]"
                maxLength={8}
              />
              <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2">
                Claim a slot <ArrowRight size={16} />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-soft/60">
              <span>No login for participants</span>
              <span className="h-1 w-1 rounded-full bg-ink/20" />
              <Link to="/login" className="underline decoration-gold/60 underline-offset-4 hover:text-ink">
                Create as an organiser
              </Link>
            </div>
          </motion.div>
          <motion.div
            className="relative md:col-span-6"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <div className="relative overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-40px_rgba(20,36,27,0.55)] ring-1 ring-ink/10">
              <img src="/images/hero.jpg" alt="People gathering outdoors" className="h-[420px] w-full object-cover md:h-[500px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="absolute bottom-5 left-5 right-5 rounded-2xl bg-cream/95 p-4 shadow-xl backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.16em] text-sage">Live inventory</p>
                  <LiveDot />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { n: 'Morning', l: 'Open' },
                    { n: 'Midday', l: 'Full' },
                    { n: 'Evening', l: 'Open' },
                  ].map((s) => (
                    <div key={s.n} className="rounded-xl bg-parchment px-3 py-2">
                      <p className="text-[11px] text-ink/50">{s.n}</p>
                      <p className="font-display text-sm">{s.l}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-y border-ink/6 bg-cream/50">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <p className="text-xs uppercase tracking-[0.22em] text-sage">Why teams switch</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight md:text-4xl">
            Ad-hoc tools were never designed for a rush of claims.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                old: 'Group chats',
                pain: 'The same slot claimed in three threads. Screenshots. Confusion at the door.',
              },
              {
                icon: ClipboardList,
                old: 'Forms',
                pain: 'No live inventory. Overbooked sessions discovered after the form closes.',
              },
              {
                icon: Table2,
                old: 'Shared sheets',
                pain: 'Race conditions, broken formulas, and a CSV that still needs tidying.',
              },
            ].map((item) => (
              <div key={item.old} className="rounded-3xl bg-parchment p-6 ring-1 ring-ink/6">
                <item.icon className="h-5 w-5 text-terra" />
                <h3 className="mt-4 font-display text-xl">{item.old}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">{item.pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 md:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-sage">The FairSlot ledger</p>
            <h2 className="mt-3 font-display text-3xl leading-tight md:text-4xl">
              Calm tools for a noisy sign-up.
            </h2>
          </div>
          <p className="text-ink-soft/75">
            Creators authenticate once. Participants never do. Inventory syncs the moment a slot is claimed — and a lock freezes the book forever.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Radio,
              title: 'Instant live inventory',
              body: 'Every claim writes through. Remaining counts pulse across every open browser in real time.',
            },
            {
              icon: Lock,
              title: 'Immutable locking',
              body: 'When you lock an event, allocations freeze. No silent overwrites. No last-minute edits.',
            },
            {
              icon: FileSpreadsheet,
              title: 'Tidy CSV exports',
              body: 'One click. Clean columns. Names, contacts, slots and timestamps — ready for the office.',
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-3xl bg-cream p-7 ring-1 ring-ink/6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-moss/10 text-moss">
                <f.icon size={18} />
              </div>
              <h3 className="mt-5 font-display text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-ink text-cream">
        <img src="/images/fair.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/70" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-4 md:px-8">
          {[
            { n: '01', t: 'Compose', d: 'Name the event. Add sessions, shifts or places with capacity.' },
            { n: '02', t: 'Share', d: 'A six-character code or a link. Participants join with zero login.' },
            { n: '03', t: 'Watch', d: 'Inventory fills live. Low stock glows before it vanishes.' },
            { n: '04', t: 'Lock & export', d: 'Freeze the book. Download a tidy CSV. Done.' },
          ].map((s) => (
            <div key={s.n}>
              <p className="font-display text-3xl text-gold/80">{s.n}</p>
              <h3 className="mt-3 font-display text-2xl">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cream/65">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-8">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-sage">Happening now</p>
            <h2 className="mt-2 font-display text-3xl">Open events</h2>
          </div>
          <Link to="/events" className="hidden text-sm text-ink-soft/70 underline decoration-gold/50 underline-offset-4 hover:text-ink sm:inline">
            View all
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-ink/5" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl bg-cream p-10 text-center ring-1 ring-ink/6">
            <Sparkles className="mx-auto text-gold" />
            <p className="mt-3 text-ink-soft/70">No public events yet — create one in the studio, or join with a code.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {events.map((ev) => (
              <EventCard key={ev.id} event={ev} href={`/e/${ev.join_code}`} />
            ))}
          </div>
        )}
      </section>

      <section className="px-5 pb-20 md:px-8">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-moss px-8 py-14 text-cream md:px-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl leading-tight md:text-4xl">Open your studio. Share a code. Watch it fill.</h2>
              <p className="mt-4 text-cream/75">Creators sign in once. Participants never need an account.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Link to="/login" className="rounded-full bg-cream px-6 py-3 text-center text-sm font-medium text-ink hover:bg-parchment transition-colors">
                Start as a creator
              </Link>
              <Link to="/join" className="rounded-full border border-cream/30 px-6 py-3 text-center text-sm text-cream hover:bg-cream/10 transition-colors">
                I have a join code
              </Link>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
