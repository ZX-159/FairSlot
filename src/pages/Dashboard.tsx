import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Radio, Lock, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import EventCard from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { authFetch, formatRelative, parseJsonSafe } from '../lib/api';
import type { DashboardPayload, EventRecord } from '../lib/types';

export default function Dashboard() {
  const { session, user } = useAuth();
  const [payload, setPayload] = useState<DashboardPayload>({ events: [], recentClaims: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await authFetch('/api/events', session);
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not load studio');
      if (!data) throw new Error('Could not load studio');
      setPayload({ events: data.events || [], recentClaims: data.recentClaims || [] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load studio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const events = payload.events;
  const capacity = events.reduce((a, e) => a + (e.capacity || 0), 0);
  const claimed = events.reduce((a, e) => a + (e.claimed || 0), 0);
  const live = events.filter((e) => e.status === 'live' && !e.locked).length;
  const firstName = user?.email?.split('@')[0] || 'organiser';

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sage">Studio</p>
            <h1 className="mt-1 font-display text-4xl capitalize">Good day, {firstName}</h1>
            <p className="mt-2 text-sm text-ink-soft/70">Compose events, watch inventory, lock the book.</p>
          </div>
          <Link to="/events/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} /> New event
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Radio, label: 'Live events', value: live },
            { icon: Users, label: 'Claims across books', value: claimed },
            { icon: Lock, label: 'Open inventory', value: Math.max(0, capacity - claimed) },
          ].map((s) => (
            <div key={s.label} className="rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
              <s.icon size={16} className="text-moss" />
              <p className="mt-4 font-display text-3xl tabular-nums">{s.value}</p>
              <p className="text-xs uppercase tracking-wider text-ink/45">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-ink/5" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-10 rounded-2xl bg-terra/10 p-4 text-terra">{error}</p>
        ) : events.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 overflow-hidden rounded-[2rem] bg-cream ring-1 ring-ink/6">
            <div className="grid md:grid-cols-2">
              <img src="/images/notebook.jpg" alt="" className="h-64 w-full object-cover md:h-full" />
              <div className="p-8 md:p-10">
                <h2 className="font-display text-3xl">Your ledger is empty</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
                  Compose a workshop, conference, volunteer rota or performance. Share a six-character code or a link. Watch it fill.
                </p>
                <Link to="/events/new" className="btn-primary mt-6 inline-flex">
                  Compose first event
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl">Your events</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {events.map((ev: EventRecord) => (
                  <EventCard key={ev.id} event={ev} href={`/studio/${ev.id}`} showCode />
                ))}
              </div>
            </div>
            <aside>
              <h2 className="font-display text-2xl">Recent claims</h2>
              <div className="mt-5 space-y-3">
                {payload.recentClaims.length === 0 && (
                  <p className="rounded-2xl bg-cream p-4 text-sm text-ink-soft/60 ring-1 ring-ink/6">No claims yet.</p>
                )}
                {payload.recentClaims.map((c) => {
                  const ev = events.find((e) => e.id === c.event_id);
                  return (
                    <div key={c.id} className="rounded-2xl bg-cream p-4 ring-1 ring-ink/6">
                      <p className="text-sm font-medium">{c.participant_name}</p>
                      <p className="text-xs text-ink-soft/60">{ev?.title || 'Event'}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-sage">{formatRelative(c.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
