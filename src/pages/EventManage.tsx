import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Lock, Plus, Trash2, Copy, Check, Radio, RefreshCw, ExternalLink, MapPin, Pencil } from 'lucide-react';
import Navbar from '../components/Navbar';
import LiveDot from '../components/LiveDot';
import EventSettingsFields from '../components/EventSettingsFields';
import { useAuth } from '../contexts/AuthContext';
import { authFetch, formatDate, formatRelative, parseJsonSafe } from '../lib/api';
import { eventShareUrl } from '../lib/codes';
import { defaultSettings, toLocalInput } from '../lib/settings';
import type { ClaimRecord, EventRecord, EventSettings, SlotRecord } from '../lib/types';
import supabase from '../lib/supabase';

interface Detail extends EventRecord {
  slots: SlotRecord[];
  claims: ClaimRecord[];
  settings: EventSettings;
}

export default function EventManage() {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [slotName, setSlotName] = useState('');
  const [slotDesc, setSlotDesc] = useState('');
  const [slotCat, setSlotCat] = useState('Session');
  const [slotCap, setSlotCap] = useState(4);
  const [slotErr, setSlotErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockConfirm, setLockConfirm] = useState(false);
  const [msg, setMsg] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [settings, setSettings] = useState<EventSettings>(defaultSettings());
  const [savingSettings, setSavingSettings] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaLocation, setMetaLocation] = useState('');
  const [metaDate, setMetaDate] = useState('');
  const [metaCategory, setMetaCategory] = useState('General');
  const [metaBusy, setMetaBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    try {
      const res = await authFetch(`/api/events?id=${id}`, session);
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Not found');
      if (!data) throw new Error('Not found');
      setEvent(data);
      setSettings({ ...defaultSettings(), ...(data.settings || {}) });
      setMetaTitle(data.title || '');
      setMetaDesc(data.description || '');
      setMetaLocation(data.location || '');
      setMetaDate(toLocalInput(data.event_date));
      setMetaCategory(data.category || 'General');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session && id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, id]);

  useEffect(() => {
    if (!event?.id) return;
    const channel = supabase
      .channel(`studio-${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots', filter: `event_id=eq.${event.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims', filter: `event_id=eq.${event.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const stats = useMemo(() => {
    if (!event) return { cap: 0, claimed: 0, fill: 0 };
    const cap = event.slots.reduce((a, s) => a + s.capacity, 0);
    const claimed = event.slots.reduce((a, s) => a + s.claimed_count, 0);
    return { cap, claimed, fill: cap ? Math.round((claimed / cap) * 100) : 0 };
  }, [event]);

  const addSlot = async (e: FormEvent) => {
    e.preventDefault();
    if (!event || event.locked) return;
    if (!slotName.trim()) {
      setSlotErr('Name the slot.');
      return;
    }
    setBusy(true);
    setSlotErr('');
    try {
      const res = await authFetch('/api/slots', session, {
        method: 'POST',
        body: JSON.stringify({
          event_id: event.id,
          name: slotName.trim(),
          description: slotDesc,
          category: slotCat,
          capacity: slotCap,
          sort_order: event.slots.length,
        }),
      });
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not add');
      setSlotName('');
      setSlotDesc('');
      await load();
    } catch (err: unknown) {
      setSlotErr(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setBusy(false);
    }
  };

  const removeSlot = async (slotId: number) => {
    if (!confirm('Remove this slot and its claims?')) return;
    const res = await authFetch('/api/slots', session, {
      method: 'DELETE',
      body: JSON.stringify({ id: slotId }),
    });
    if (res.ok) load();
  };

  const toggleSlotLock = async (slot: SlotRecord) => {
    await authFetch('/api/slots', session, {
      method: 'PUT',
      body: JSON.stringify({ id: slot.id, locked: !slot.locked }),
    });
    load();
  };

  const setStatus = async (status: string) => {
    if (!event) return;
    const res = await authFetch('/api/events', session, {
      method: 'PUT',
      body: JSON.stringify({ id: event.id, status }),
    });
    const data = await parseJsonSafe(res) as any;
    if (!res.ok) {
      setMsg(data?.error || 'Could not update');
      return;
    }
    load();
  };

  const saveSettings = async () => {
    if (!event) return;
    setSavingSettings(true);
    setMsg('');
    setOkMsg('');
    try {
      const res = await authFetch('/api/events', session, {
        method: 'PUT',
        body: JSON.stringify({ id: event.id, settings }),
      });
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not save settings');
      setOkMsg('Settings saved.');
      setSettings({ ...defaultSettings(), ...(data.settings || settings) });
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const lockEvent = async () => {
    if (!event) return;
    const res = await authFetch('/api/events', session, {
      method: 'PUT',
      body: JSON.stringify({ id: event.id, locked: true }),
    });
    const data = await parseJsonSafe(res) as any;
    if (!res.ok) {
      setMsg(data?.error || 'Could not lock');
      return;
    }
    setLockConfirm(false);
    load();
  };

  const destroy = async () => {
    if (!event) return;
    setDeleteBusy(true);
    setMsg('');
    try {
      const res = await authFetch('/api/events', session, {
        method: 'DELETE',
        body: JSON.stringify({ id: event.id }),
      });
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not delete');
      navigate('/dashboard');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Could not delete');
      setDeleteConfirm(false);
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveMeta = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!event || event.locked) return;
    if (!metaTitle.trim()) {
      setMsg('Title cannot be empty.');
      return;
    }
    setMetaBusy(true);
    setMsg('');
    setOkMsg('');
    try {
      const res = await authFetch('/api/events', session, {
        method: 'PUT',
        body: JSON.stringify({
          id: event.id,
          title: metaTitle.trim(),
          description: metaDesc, // empty string clears
          location: metaLocation, // empty string clears
          event_date: metaDate ? new Date(metaDate).toISOString() : null,
          category: metaCategory,
        }),
      });
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not save');
      setOkMsg('Event details saved.');
      setEditingMeta(false);
      await load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setMetaBusy(false);
    }
  };

  const regenerateCode = async () => {
    if (!event || event.locked) return;
    if (!confirm('Generate a new magic link? The old share link will stop working.')) return;
    setMsg('');
    setOkMsg('');
    const res = await authFetch('/api/events', session, {
      method: 'POST',
      body: JSON.stringify({ action: 'regenerate_code', id: event.id }),
    });
    const data = await parseJsonSafe(res) as any;
    if (!res.ok) {
      setMsg(data?.error || 'Could not regenerate code');
      return;
    }
    setOkMsg('New magic link ready. Copy it below.');
    await load();
  };

  const duplicateEvent = async () => {
    if (!event) return;
    setMsg('');
    const res = await authFetch('/api/events', session, {
      method: 'POST',
      body: JSON.stringify({ action: 'duplicate', id: event.id }),
    });
    const data = await parseJsonSafe(res) as any;
    if (!res.ok) {
      setMsg(data?.error || 'Could not duplicate');
      return;
    }
    navigate(`/studio/${data.id}`);
  };

  const removeClaim = async (claimId: number) => {
    if (!event || event.locked) return;
    if (!confirm('Remove this claim and free the seat?')) return;
    const res = await authFetch('/api/claims', session, {
      method: 'DELETE',
      body: JSON.stringify({ id: claimId }),
    });
    if (res.ok) load();
    else {
      const data = await parseJsonSafe(res) as any;
      setMsg(data?.error || 'Could not remove claim');
    }
  };

  const exportCsv = async () => {
    if (!session || !event) return;
    const res = await fetch(`/api/export?event_id=${event.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      setMsg('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fairslot-${event.join_code}-claims.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareUrl = event ? eventShareUrl(event.join_code) : '';

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const copyCode = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(event.join_code);
    } catch {
      /* ignore */
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1600);
  };

  const openShare = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="h-80 animate-pulse rounded-[2rem] bg-ink/5" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="font-display text-4xl">Event not found</h1>
          <p className="mt-3 text-ink-soft/70">{error}</p>
          <Link to="/dashboard" className="btn-primary mt-6 inline-block">
            Back to studio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/dashboard" className="text-xs uppercase tracking-wider text-ink/40 hover:text-ink">
              ← Studio
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {event.locked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] uppercase tracking-wider text-cream">
                  <Lock size={11} /> Immutable
                </span>
              ) : event.status === 'live' ? (
                <LiveDot />
              ) : (
                <span className="rounded-full bg-parchment px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink/50 ring-1 ring-ink/10">
                  {event.status}
                </span>
              )}
              <button onClick={copyCode} className="font-mono text-xs tracking-[0.22em] text-ink/45 hover:text-ink">
                {copiedCode ? 'Copied' : event.join_code}
              </button>
            </div>
            <h1 className="mt-2 font-display text-4xl">{event.title}</h1>
            <p className="mt-2 text-sm text-ink-soft/70">
              {formatDate(event.event_date, true)} {event.location ? `· ${event.location}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-ink/8">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Share link'}
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 text-sm ring-1 ring-ink/8">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-sage">Magic share link</p>
              <p className="mt-1 break-all font-mono text-sm text-ink/80">{shareUrl}</p>
              <p className="mt-2 text-xs text-ink/45">
                Code <span className="font-mono tracking-[0.18em] text-ink/70">{event.join_code}</span>
                {' '}· no login required · open on any device
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs text-cream">
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/10">
                {copiedCode ? 'Code copied' : 'Copy code'}
              </button>
              <button type="button" onClick={openShare} className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/10">
                <ExternalLink size={12} /> Preview
              </button>
              {!event.locked && (
                <button type="button" onClick={regenerateCode} className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/10" title="Invalidate old link">
                  <RefreshCw size={12} /> New code
                </button>
              )}
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-sage">Event details</p>
              <h2 className="font-display text-xl">Title, place & time</h2>
            </div>
            {!event.locked && (
              <button
                type="button"
                onClick={() => setEditingMeta((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full bg-parchment px-3 py-1.5 text-xs ring-1 ring-ink/10"
              >
                <Pencil size={12} /> {editingMeta ? 'Close' : 'Edit'}
              </button>
            )}
          </div>
          {editingMeta && !event.locked ? (
            <form onSubmit={saveMeta} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wider text-ink/45">Title</span>
                <input className="input-field" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} required />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wider text-ink/45">Description (optional — clear to empty)</span>
                <textarea className="input-field min-h-[88px] resize-none" value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="What participants need to know" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-ink/45">Location (optional)</span>
                <input className="input-field" value={metaLocation} onChange={(e) => setMetaLocation(e.target.value)} placeholder="Hall B / leave blank" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wider text-ink/45">Date & time (optional)</span>
                <input className="input-field" type="datetime-local" value={metaDate} onChange={(e) => setMetaDate(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wider text-ink/45">Category</span>
                <input className="input-field" value={metaCategory} onChange={(e) => setMetaCategory(e.target.value)} />
              </label>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button type="submit" disabled={metaBusy} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                  {metaBusy ? 'Saving…' : 'Save details'}
                </button>
                <button
                  type="button"
                  className="rounded-full px-4 py-2 text-sm text-ink/50"
                  onClick={() => {
                    setMetaLocation('');
                    setMetaDate('');
                    setMetaDesc('');
                  }}
                >
                  Clear optional fields
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3 space-y-1 text-sm text-ink-soft/75">
              <p>{event.description || <span className="italic text-ink/35">No description</span>}</p>
              <p className="inline-flex items-center gap-1.5">
                <MapPin size={13} /> {event.location || <span className="italic text-ink/35">No location set</span>}
              </p>
              <p>{formatDate(event.event_date, true)}</p>
            </div>
          )}
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
            <p className="text-[11px] uppercase tracking-wider text-sage">Fill rate</p>
            <p className="mt-2 font-display text-4xl tabular-nums">{stats.fill}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/8">
              <div className="h-full rounded-full bg-moss" style={{ width: `${stats.fill}%` }} />
            </div>
          </div>
          <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
            <p className="text-[11px] uppercase tracking-wider text-sage">Claimed</p>
            <p className="mt-2 font-display text-4xl tabular-nums">
              {stats.claimed}
              <span className="text-xl text-ink/30">/{stats.cap}</span>
            </p>
          </div>
          <div className="rounded-3xl bg-cream p-5 ring-1 ring-ink/6">
            <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sage">
              <Radio size={12} /> Remaining
            </p>
            <p className="mt-2 font-display text-4xl tabular-nums">{Math.max(0, stats.cap - stats.claimed)}</p>
          </div>
        </div>

        {msg && <p className="mt-4 rounded-xl bg-terra/10 px-3 py-2 text-sm text-terra">{msg}</p>}
        {okMsg && <p className="mt-4 rounded-xl bg-moss/10 px-3 py-2 text-sm text-moss">{okMsg}</p>}

        <div className="mt-10 grid gap-10 lg:grid-cols-5">
          <section className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">Inventory</h2>
            </div>
            <div className="space-y-3">
              {event.slots.length === 0 && (
                <p className="rounded-2xl bg-cream p-6 text-sm text-ink-soft/60 ring-1 ring-ink/6">Add your first session, shift or place.</p>
              )}
              {event.slots.map((slot) => (
                <div key={slot.id} className="rounded-2xl bg-cream p-4 ring-1 ring-ink/6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-sage">{slot.category}</p>
                      <p className="font-display text-lg">{slot.name}</p>
                      {slot.description && <p className="mt-1 text-sm text-ink-soft/65">{slot.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-parchment px-2 py-0.5 text-xs tabular-nums">
                        {slot.claimed_count}/{slot.capacity}
                      </span>
                      {!event.locked && (
                        <>
                          <button onClick={() => toggleSlotLock(slot)} className="rounded-full p-2 text-ink/40 hover:bg-parchment hover:text-ink" title={slot.locked ? 'Unlock slot' : 'Lock slot'}>
                            <Lock size={14} className={slot.locked ? 'text-terra' : ''} />
                          </button>
                          <button onClick={() => removeSlot(slot.id)} className="rounded-full p-2 text-ink/40 hover:bg-terra/10 hover:text-terra">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full bg-moss" style={{ width: `${Math.min(100, (slot.claimed_count / Math.max(1, slot.capacity)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {!event.locked && (
              <form onSubmit={addSlot} className="mt-5 rounded-3xl bg-cream p-5 ring-1 ring-ink/8">
                <p className="font-display text-lg">Add a slot</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input className="input-field" placeholder="Name — Morning workshop" value={slotName} onChange={(e) => setSlotName(e.target.value)} />
                  <input className="input-field" placeholder="Category" value={slotCat} onChange={(e) => setSlotCat(e.target.value)} />
                </div>
                <textarea className="input-field mt-3 min-h-[72px] resize-none" placeholder="Short description" value={slotDesc} onChange={(e) => setSlotDesc(e.target.value)} />
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-sm text-ink/50">
                    Capacity
                    <input
                      type="number"
                      min={1}
                      className="input-field ml-2 w-20"
                      value={slotCap}
                      onChange={(e) => setSlotCap(Number(e.target.value))}
                    />
                  </label>
                  <button type="submit" disabled={busy} className="btn-primary ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm">
                    <Plus size={14} /> Add
                  </button>
                </div>
                {slotErr && <p className="mt-2 text-sm text-terra">{slotErr}</p>}
              </form>
            )}
          </section>

          <section className="lg:col-span-2">
            <h2 className="font-display text-2xl">Claims</h2>
            <div className="mt-4 max-h-[520px] space-y-2 overflow-auto pr-1">
              {event.claims.length === 0 && <p className="rounded-2xl bg-cream p-5 text-sm text-ink-soft/60 ring-1 ring-ink/6">Waiting for the first claim.</p>}
              {event.claims.map((c) => {
                const slot = event.slots.find((s) => s.id === c.slot_id);
                return (
                  <div key={c.id} className="rounded-2xl bg-cream p-4 ring-1 ring-ink/6">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.participant_name}</p>
                        <p className="text-xs text-ink-soft/60">{c.participant_email}</p>
                        <p className="mt-1 text-xs text-moss">{slot?.name || 'Slot'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] text-ink/35">{formatRelative(c.created_at)}</span>
                        {!event.locked && (
                          <button type="button" onClick={() => removeClaim(c.id)} className="text-[11px] text-terra/80 hover:text-terra">
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-3xl bg-ink p-5 text-cream">
              <h3 className="font-display text-xl">Book controls</h3>
              <p className="mt-1 text-xs text-cream/60">Publishing is reversible. Locking is not. Delete removes the event forever.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {!event.locked && event.status !== 'live' && (
                  <button type="button" onClick={() => setStatus('live')} className="rounded-full bg-cream px-4 py-2 text-sm text-ink">
                    Go live
                  </button>
                )}
                {!event.locked && event.status === 'live' && (
                  <button type="button" onClick={() => setStatus('closed')} className="rounded-full border border-cream/20 px-4 py-2 text-sm">
                    Close claims
                  </button>
                )}
                {!event.locked && event.status === 'closed' && (
                  <button type="button" onClick={() => setStatus('draft')} className="rounded-full border border-cream/20 px-4 py-2 text-sm">
                    Back to draft
                  </button>
                )}
                <button type="button" onClick={duplicateEvent} className="rounded-full border border-cream/20 px-4 py-2 text-sm">
                  Duplicate
                </button>
                {!event.locked && (
                  <button type="button" onClick={() => setLockConfirm(true)} className="inline-flex items-center gap-1.5 rounded-full bg-terra px-4 py-2 text-sm">
                    <Lock size={13} /> Lock forever
                  </button>
                )}
                {!event.locked && (
                  <button type="button" onClick={() => setDeleteConfirm(true)} className="rounded-full px-4 py-2 text-sm text-cream/50 hover:text-cream">
                    Delete event
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-12 rounded-[2rem] bg-cream p-6 ring-1 ring-ink/8 md:p-8">
          <EventSettingsFields value={settings} onChange={setSettings} disabled={event.locked} />
          {!event.locked && (
            <button type="button" onClick={saveSettings} disabled={savingSettings} className="btn-primary mt-8 disabled:opacity-60">
              {savingSettings ? 'Saving…' : 'Save security & notices'}
            </button>
          )}
        </section>
      </main>

      <AnimatePresence>
        {lockConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5 backdrop-blur-sm">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-md rounded-3xl bg-cream p-7">
              <h3 className="font-display text-2xl">Lock this book?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">
                Locking is immutable. Slots and claims freeze. You will still be able to export CSV, but nothing can be edited or deleted.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setLockConfirm(false)} className="rounded-full px-4 py-2 text-sm text-ink/60">
                  Cancel
                </button>
                <button type="button" onClick={lockEvent} className="rounded-full bg-terra px-4 py-2 text-sm text-cream">
                  Lock forever
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5 backdrop-blur-sm">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-md rounded-3xl bg-cream p-7">
              <h3 className="font-display text-2xl">Delete this event?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">
                This permanently removes the event, all slots, and all claims. This cannot be undone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteConfirm(false)} className="rounded-full px-4 py-2 text-sm text-ink/60" disabled={deleteBusy}>
                  Cancel
                </button>
                <button type="button" onClick={destroy} disabled={deleteBusy} className="rounded-full bg-terra px-4 py-2 text-sm text-cream disabled:opacity-60">
                  {deleteBusy ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
