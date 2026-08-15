import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EventCard from '../components/EventCard';
import type { EventRecord } from '../lib/types';

export default function PublicEvents() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/public');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load events');
        setEvents(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Could not load events');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cats = ['All', ...Array.from(new Set(events.map((e) => e.category).filter(Boolean)))];
  const filtered = events.filter((e) => {
    const matchQ = !q || `${e.title} ${e.location} ${e.join_code}`.toLowerCase().includes(q.toLowerCase());
    const matchC = cat === 'All' || e.category === cat;
    return matchQ && matchC;
  });

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-12 md:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-sage">Zero login</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl">Open events</h1>
        <p className="mt-3 max-w-xl text-ink-soft/75">
          Pick an event and claim a slot. Unlisted events stay hidden — use a share link or join code for those.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, place or code"
              className="input-field pl-11"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                  cat === c ? 'bg-ink text-cream' : 'bg-cream text-ink/60 ring-1 ring-ink/8'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-3xl bg-ink/5" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-10 rounded-2xl bg-terra/10 p-4 text-terra">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="mt-10 rounded-3xl bg-cream p-10 text-center text-ink-soft/70 ring-1 ring-ink/6">
            No matching public events. Try a join code instead.
          </p>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {filtered.map((ev) => (
              <EventCard key={ev.id} event={ev} href={`/e/${ev.join_code}`} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
