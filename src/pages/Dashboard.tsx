import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Radio,
  Lock,
  Users,
  Search,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Settings,
  Copy,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import EventCard from '../components/EventCard';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { authFetch, formatRelative, parseJsonSafe, ApiError } from '../lib/api';
import { eventShareUrl } from '../lib/codes';
import type { DashboardPayload, EventRecord } from '../lib/types';

type Filter = 'all' | 'live' | 'draft' | 'closed' | 'locked';
type SortKey = 'newest' | 'title' | 'fill' | 'date';

export default function Dashboard() {
  const { session, user, configured } = useAuth();
  const toast = useToast();
  const [payload, setPayload] = useState<DashboardPayload>({ events: [], recentClaims: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [refreshing, setRefreshing] = useState(false);

  const load = async (soft = false) => {
    if (!session) return;
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/events', session, { retries: 2 });
      const data = (await parseJsonSafe(res)) as any;
      if (!res.ok) throw new ApiError(data?.error || 'Could not load studio', res.status);
      if (!data) throw new Error('Could not load studio');
      setPayload({ events: data.events || [], recentClaims: data.recentClaims || [] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load studio');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (session) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const events = payload.events;
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = events.filter((e) => {
      if (filter === 'live' && !(e.status === 'live' && !e.locked)) return false;
      if (filter === 'draft' && e.status !== 'draft') return false;
      if (filter === 'closed' && e.status !== 'closed') return false;
      if (filter === 'locked' && !e.locked) return false;
      if (!query) return true;
      return `${e.title} ${e.location || ''} ${e.join_code} ${e.category}`.toLowerCase().includes(query);
    });
    list = [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'fill') return (b.fill || 0) - (a.fill || 0);
      if (sort === 'date') {
        const ta = a.event_date ? new Date(a.event_date).getTime() : 0;
        const tb = b.event_date ? new Date(b.event_date).getTime() : 0;
        return ta - tb;
      }
      // newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [events, q, filter, sort]);

  const capacity = events.reduce((a, e) => a + (e.capacity || 0), 0);
  const claimed = events.reduce((a, e) => a + (e.claimed || 0), 0);
  const live = events.filter((e) => e.status === 'live' && !e.locked).length;
  const drafts = events.filter((e) => e.status === 'draft').length;
  const firstName = user?.email?.split('@')[0] || 'organiser';

  const copyLink = async (ev: EventRecord) => {
    const url = eventShareUrl(ev.join_code);
    try {
      await navigator.clipboard.writeText(url);
      toast.ok('Share link copied');
    } catch {
      toast.err('Could not copy link');
    }
  };

  const quickStatus = async (ev: EventRecord, status: string) => {
    if (ev.locked) {
      toast.err('Locked events cannot change status');
      return;
    }
    try {
      const res = await authFetch('/api/events', session, {
        method: 'PUT',
        body: JSON.stringify({ id: ev.id, status }),
      });
      const data = (await parseJsonSafe(res)) as any;
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      toast.ok(`Marked ${status}`);
      load(true);
    } catch (err: unknown) {
      toast.err(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const duplicate = async (ev: EventRecord) => {
    try {
      const res = await authFetch('/api/events', session, {
        method: 'POST',
        body: JSON.stringify({ action: 'duplicate', id: ev.id }),
      });
      const data = (await parseJsonSafe(res)) as any;
      if (!res.ok) throw new Error(data?.error || 'Duplicate failed');
      toast.ok('Draft copy created');
      window.location.href = `/studio/${data.id}`;
    } catch (err: unknown) {
      toast.err(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  if (!configured) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <main className="mx-auto max-w-lg px-5 py-20 text-center">
          <h1 className="font-display text-3xl">Supabase is not configured</h1>
          <p className="mt-3 text-sm text-ink-soft/70">
            Set <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
            <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> as build variables, then redeploy.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sage">Studio</p>
            <h1 className="mt-1 font-display text-4xl capitalize">Good day, {firstName}</h1>
            <p className="mt-2 text-sm text-ink-soft/70">Compose events, watch inventory, share magic links, export CSV.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-ink/8"
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link to="/events/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> New event
            </Link>
          </div>
        </div>

        {/* Creator shortcut strip */}
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/events/new', icon: Plus, label: 'Compose event', hint: 'Wizard with starter slots' },
            { to: '/guide', icon: BookOpen, label: 'Creator guide', hint: 'How every control works' },
            { to: '/faq', icon: HelpCircle, label: 'FAQ', hint: 'Short answers' },
            { to: '/account', icon: Settings, label: 'Account', hint: 'Password & email' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 ring-1 ring-ink/6 transition hover:ring-moss/30"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-moss/10 text-moss">
                <item.icon size={16} />
              </span>
              <span>
                <span className="block text-sm font-medium text-ink">{item.label}</span>
                <span className="block text-[11px] text-ink/45">{item.hint}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Radio, label: 'Live events', value: live },
            { icon: LayoutGrid, label: 'Drafts', value: drafts },
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

        {events.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
              <input
                className="input-field w-full pl-9"
                placeholder="Search title, code, place…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['live', 'Live'],
                  ['draft', 'Draft'],
                  ['closed', 'Closed'],
                  ['locked', 'Locked'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider ${
                    filter === id ? 'bg-ink text-cream' : 'bg-cream text-ink/55 ring-1 ring-ink/8'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="input-field w-auto py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort events"
            >
              <option value="newest">Newest</option>
              <option value="title">Title A–Z</option>
              <option value="fill">Fill rate</option>
              <option value="date">Event date</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-ink/5" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl bg-terra/10 p-4 text-terra">
            <p>{error}</p>
            <button type="button" onClick={() => load()} className="mt-3 text-sm underline">
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 overflow-hidden rounded-[2rem] bg-cream ring-1 ring-ink/6"
          >
            <div className="grid md:grid-cols-2">
              <img src="/images/notebook.jpg" alt="" className="h-64 w-full object-cover md:h-full" />
              <div className="p-8 md:p-10">
                <h2 className="font-display text-3xl">Your ledger is empty</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft/75">
                  Compose a workshop, conference, volunteer rota or performance. Share a magic link. Watch it fill.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link to="/events/new" className="btn-primary inline-flex">
                    Compose first event
                  </Link>
                  <Link to="/guide" className="rounded-full bg-parchment px-4 py-2 text-sm ring-1 ring-ink/10">
                    Read the guide
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="mt-12 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="font-display text-2xl">
                Your events
                <span className="ml-2 text-base text-ink/35">({filtered.length})</span>
              </h2>
              {filtered.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-cream p-5 text-sm text-ink-soft/60 ring-1 ring-ink/6">
                  No events match this filter.
                </p>
              ) : (
                <div className="mt-5 space-y-5">
                  {filtered.map((ev: EventRecord) => (
                    <div key={ev.id} className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink/6">
                      <EventCard event={ev} href={`/studio/${ev.id}`} showCode />
                      <div className="flex flex-wrap gap-2 border-t border-ink/6 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => copyLink(ev)}
                          className="inline-flex items-center gap-1 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/8"
                        >
                          <Copy size={12} /> Copy link
                        </button>
                        <a
                          href={eventShareUrl(ev.join_code)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/8"
                        >
                          <ExternalLink size={12} /> Open board
                        </a>
                        <Link
                          to={`/studio/${ev.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/8"
                        >
                          Manage
                        </Link>
                        {!ev.locked && ev.status !== 'live' && (
                          <button
                            type="button"
                            onClick={() => quickStatus(ev, 'live')}
                            className="rounded-full bg-moss/10 px-3 py-1.5 text-xs text-moss"
                          >
                            Go live
                          </button>
                        )}
                        {!ev.locked && ev.status === 'live' && (
                          <button
                            type="button"
                            onClick={() => quickStatus(ev, 'closed')}
                            className="rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/8"
                          >
                            Close
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => duplicate(ev)}
                          className="rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/8"
                        >
                          Duplicate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <aside className="space-y-8">
              <div>
                <h2 className="font-display text-2xl">Recent claims</h2>
                <div className="mt-5 space-y-3">
                  {payload.recentClaims.length === 0 && (
                    <p className="rounded-2xl bg-cream p-4 text-sm text-ink-soft/60 ring-1 ring-ink/6">No claims yet.</p>
                  )}
                  {payload.recentClaims.map((c) => {
                    const ev = events.find((e) => e.id === c.event_id);
                    return (
                      <Link
                        key={c.id}
                        to={ev ? `/studio/${ev.id}` : '/dashboard'}
                        className="block rounded-2xl bg-cream p-4 ring-1 ring-ink/6 transition hover:ring-moss/30"
                      >
                        <p className="text-sm font-medium">{c.participant_name}</p>
                        <p className="text-xs text-ink-soft/60">{ev?.title || 'Event'}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-wider text-sage">
                          {formatRelative(c.created_at)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-3xl bg-ink p-5 text-cream">
                <h3 className="font-display text-xl">Tips</h3>
                <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-cream/70">
                  <li>Use the composer wizard for starter slots + security in one pass.</li>
                  <li>Copy link from here without opening the full studio.</li>
                  <li>Read the Creator guide before a busy registration day.</li>
                </ul>
                <Link to="/guide" className="mt-4 inline-block text-sm text-gold underline">
                  Open guide →
                </Link>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
