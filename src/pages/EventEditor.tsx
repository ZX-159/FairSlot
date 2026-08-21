import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import EventSettingsFields from '../components/EventSettingsFields';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { authFetch, parseJsonSafe } from '../lib/api';
import { defaultSettings } from '../lib/settings';
import type { EventSettings } from '../lib/types';

const covers = [
  '/images/fair.jpg',
  '/images/classroom.jpg',
  '/images/sports.jpg',
  '/images/concert.jpg',
  '/images/garden.jpg',
];
const cats = ['Workshop', 'Conference', 'Volunteer', 'Performance', 'Sports', 'Community', 'General'];

type Step = 1 | 2 | 3 | 4;

export default function EventEditor() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [category, setCategory] = useState('General');
  const [cover, setCover] = useState(covers[0]);
  const [status, setStatus] = useState<'draft' | 'live'>('live');
  const [settings, setSettings] = useState<EventSettings>(defaultSettings());
  const [starterSlots, setStarterSlots] = useState('Morning session, 12, Session\nAfternoon session, 12, Session');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const steps = useMemo(
    () =>
      [
        { n: 1 as Step, label: 'Basics' },
        { n: 2 as Step, label: 'Publish' },
        { n: 3 as Step, label: 'Starter slots' },
        { n: 4 as Step, label: 'Security' },
      ] as const,
    []
  );

  const validateStep = (s: Step) => {
    if (s === 1 && !title.trim()) {
      setError('Give the event a name before continuing.');
      return false;
    }
    setError('');
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1) as Step);
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1) as Step);

  const parseStarterSlots = () => {
    return starterSlots
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 40)
      .map((line) => {
        const parts = line.split(/[,|\t]/).map((p) => p.trim());
        return {
          name: parts[0] || '',
          capacity: Math.max(1, Number(parts[1]) || 1),
          category: parts[2] || 'Session',
          description: parts[3] || '',
        };
      })
      .filter((s) => s.name);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(1)) {
      setStep(1);
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
      const data = (await parseJsonSafe(res)) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not create');
      if (!data?.id) throw new Error('Could not create');

      const slots = parseStarterSlots();
      if (slots.length) {
        const slotRes = await authFetch('/api/slots', session, {
          method: 'POST',
          body: JSON.stringify({ action: 'bulk', event_id: data.id, slots }),
        });
        if (!slotRes.ok) {
          const err = (await parseJsonSafe(slotRes)) as any;
          toast.err(err?.error || 'Event created, but starter slots failed — add them in studio.');
        }
      }

      toast.ok(status === 'live' ? 'Event is live' : 'Draft saved');
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
        <Link to="/dashboard" className="text-xs uppercase tracking-wider text-ink/40 hover:text-ink">
          ← Studio
        </Link>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-sage">Compose</p>
        <h1 className="mt-2 font-display text-4xl">New event</h1>
        <p className="mt-2 text-sm text-ink-soft/70">
          Follow the steps in order. You can change everything later in the event studio (until locked).
        </p>

        {/* Stepper */}
        <ol className="mt-8 grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={() => {
                    if (s.n < step || validateStep(step)) setStep(s.n);
                  }}
                  className={`flex w-full flex-col items-center rounded-2xl px-1 py-3 text-center ring-1 transition ${
                    active
                      ? 'bg-ink text-cream ring-ink'
                      : done
                        ? 'bg-moss/10 text-moss ring-moss/20'
                        : 'bg-cream text-ink/45 ring-ink/8'
                  }`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-current/10 text-xs font-semibold">
                    {done ? <Check size={14} /> : s.n}
                  </span>
                  <span className="mt-1 hidden text-[10px] uppercase tracking-wider sm:block">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <form onSubmit={submit} className="mt-6 space-y-5 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-2xl">Basics</h2>
                <p className="mt-1 text-sm text-ink-soft/65">Name, story, place, and time.</p>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Title *</span>
                <input
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Community workshop"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Description</span>
                <textarea
                  className="input-field min-h-[110px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What participants need to know."
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Location</span>
                  <input
                    className="input-field"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Main hall (optional)"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Date & time</span>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
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
                      className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wider ${
                        category === c ? 'bg-ink text-cream' : 'bg-parchment text-ink/60'
                      }`}
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-2xl">Publishing</h2>
                <p className="mt-1 text-sm text-ink-soft/65">
                  Draft keeps claims closed. Live opens the board when you finish (subject to PIN/windows).
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setStatus('draft')}
                  className={`rounded-3xl p-5 text-left ring-2 transition ${
                    status === 'draft' ? 'bg-ink text-cream ring-ink' : 'bg-parchment ring-transparent'
                  }`}
                >
                  <p className="font-display text-xl">Save as draft</p>
                  <p className={`mt-1 text-xs ${status === 'draft' ? 'text-cream/70' : 'text-ink/50'}`}>
                    Build slots privately. Publish later from studio.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('live')}
                  className={`rounded-3xl p-5 text-left ring-2 transition ${
                    status === 'live' ? 'bg-ink text-cream ring-ink' : 'bg-parchment ring-transparent'
                  }`}
                >
                  <p className="font-display text-xl">Go live</p>
                  <p className={`mt-1 text-xs ${status === 'live' ? 'text-cream/70' : 'text-ink/50'}`}>
                    Ready for magic link sharing after create.
                  </p>
                </button>
              </div>
              <div className="rounded-2xl bg-parchment/80 p-4 text-sm text-ink-soft/75 ring-1 ring-ink/6">
                <p className="font-medium text-ink">Summary so far</p>
                <p className="mt-2">{title || 'Untitled event'}</p>
                <p className="mt-1 text-xs">
                  {category}
                  {location ? ` · ${location}` : ''}
                  {eventDate ? ` · ${new Date(eventDate).toLocaleString()}` : ' · Date TBC'}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-2xl">Starter slots</h2>
                <p className="mt-1 text-sm text-ink-soft/65">
                  Optional. One per line: <span className="font-mono text-xs">Name, capacity, category</span>. Leave blank
                  to add slots only in studio.
                </p>
              </div>
              <textarea
                className="input-field min-h-[160px] resize-y font-mono text-sm"
                value={starterSlots}
                onChange={(e) => setStarterSlots(e.target.value)}
                placeholder={'Morning workshop, 12, Session\nAfternoon lab, 8, Lab'}
              />
              <p className="text-xs text-ink/40">{parseStarterSlots().length} slot(s) will be created after the event.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-2xl">Security & notices</h2>
                <p className="mt-1 text-sm text-ink-soft/65">
                  PIN, claim windows, pre-notice, and ticket copy. All editable later in studio.
                </p>
              </div>
              <EventSettingsFields value={settings} onChange={setSettings} />
            </div>
          )}

          {error && <p className="rounded-xl bg-terra/10 px-3 py-2 text-sm text-terra">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-5">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1 || busy}
              className="rounded-full px-4 py-2 text-sm text-ink/60 disabled:opacity-30"
            >
              Back
            </button>
            <div className="flex flex-wrap gap-2">
              {step < 4 ? (
                <button type="button" onClick={goNext} className="btn-primary inline-flex items-center gap-1 px-5 py-2">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2 disabled:opacity-60">
                  {busy ? 'Creating…' : status === 'live' ? 'Create & go live' : 'Create draft'}
                </button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
