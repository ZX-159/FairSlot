import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import EventSettingsFields from '../components/EventSettingsFields';
import { useAuth } from '../contexts/AuthContext';
import { authFetch } from '../lib/api';
import { defaultSettings } from '../lib/settings';
import type { EventSettings } from '../lib/types';

const covers = ['/images/fair.jpg', '/images/classroom.jpg', '/images/sports.jpg', '/images/concert.jpg', '/images/garden.jpg'];
const cats = ['Workshop', 'Conference', 'Volunteer', 'Performance', 'Sports', 'Community', 'General'];

export default function EventEditor() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(covers[0]);
  const [status, setStatus] = useState<'draft' | 'live'>('live');
  const [settings, setSettings] = useState<EventSettings>(defaultSettings());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Give the event a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await authFetch('/api/events', session, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description,
          location,
          event_date: eventDate ? new Date(eventDate).toISOString() : null,
          cover_url: cover,
          category,
          status,
          settings,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create');
      navigate(`/studio/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-2xl px-5 py-12 md:px-8">
        <p className="text-xs uppercase tracking-[0.2em] text-sage">Compose</p>
        <h1 className="mt-2 font-display text-4xl">New event</h1>
        <form onSubmit={submit} className="mt-8 space-y-5 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Title</span>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Community workshop" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Description</span>
            <textarea className="input-field min-h-[110px] resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What participants need to know." />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Location</span>
              <input className="input-field" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main hall" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Date & time</span>
              <input className="input-field" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </label>
          </div>
          <div>
            <span className="mb-2 block text-xs uppercase tracking-wider text-ink/45">Category</span>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider ${category === c ? 'bg-ink text-cream' : 'bg-parchment text-ink/60'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-xs uppercase tracking-wider text-ink/45">Cover</span>
            <div className="grid grid-cols-5 gap-2">
              {covers.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCover(c)}
                  className={`overflow-hidden rounded-xl ring-2 ${cover === c ? 'ring-gold' : 'ring-transparent'}`}
                >
                  <img src={c} alt="" className="h-14 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStatus('draft')} className={`rounded-full px-4 py-2 text-sm ${status === 'draft' ? 'bg-ink text-cream' : 'bg-parchment'}`}>
              Save as draft
            </button>
            <button type="button" onClick={() => setStatus('live')} className={`rounded-full px-4 py-2 text-sm ${status === 'live' ? 'bg-ink text-cream' : 'bg-parchment'}`}>
              Go live
            </button>
          </div>

          <div className="border-t border-ink/8 pt-6">
            <EventSettingsFields value={settings} onChange={setSettings} />
          </div>

          {error && <p className="text-sm text-terra">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? 'Creating…' : 'Create event'}
          </button>
        </form>
      </main>
    </div>
  );
}
