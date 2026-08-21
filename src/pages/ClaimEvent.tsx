import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Lock, MapPin, Radio } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SlotCard from '../components/SlotCard';
import LiveDot from '../components/LiveDot';
import type { PublicEvent, SlotRecord } from '../lib/types';
import { formatDate, parseJsonSafe } from '../lib/api';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';
import supabase from '../lib/supabase';

function windowState(event: PublicEvent) {
  const opens = event.settings?.claim_opens_at ? new Date(event.settings.claim_opens_at).getTime() : null;
  const closes = event.settings?.claim_closes_at ? new Date(event.settings.claim_closes_at).getTime() : null;
  const now = Date.now();
  if (opens && now < opens) return { closed: true, reason: `Claims open ${formatDate(event.settings?.claim_opens_at, true)}.` };
  if (closes && now > closes) return { closed: true, reason: 'The claim window has closed.' };
  return { closed: false, reason: '' };
}

function mapsHref(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

export default function ClaimEvent() {
  const { code: codeParam = '' } = useParams();
  const code = normalizeJoinCode(codeParam);
  const navigate = useNavigate();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [noticeAck, setNoticeAck] = useState(false);
  const [noticePassed, setNoticePassed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const applyPayload = (data: PublicEvent & { needs_pin?: boolean }) => {
    if (data.needs_pin) {
      setNeedsPin(true);
      setEvent(data);
      return;
    }
    setNeedsPin(false);
    setEvent(data);
    const hasNotice = !!(data.settings?.notice_title || data.settings?.notice_body);
    if (!hasNotice && !data.settings?.require_notice_ack) setNoticePassed(true);
  };

  const load = async (enteredPin?: string) => {
    if (!isValidJoinCode(code)) {
      setError('This share link is invalid. Check the code with your organiser.');
      setEvent(null);
      setLoading(false);
      return null;
    }
    try {
      const pinQ = enteredPin != null ? `&pin=${encodeURIComponent(enteredPin)}` : '';
      const res = await fetch(`/api/public?code=${encodeURIComponent(code)}${pinQ}`);
      const data = await parseJsonSafe(res) as PublicEvent & { needs_pin?: boolean } | null;
      if (!res.ok) throw new Error((data as any)?.error || 'Event not found');
      if (!data) throw new Error('Event not found');
      applyPayload(data);
      setError('');
      return data as PublicEvent & { needs_pin?: boolean };
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Event not found');
      setEvent(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!event?.id || needsPin) return;
    const channel = supabase
      .channel(`event-slots-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'slots', filter: `event_id=eq.${event.id}` },
        (payload) => {
          setPulse(true);
          setTimeout(() => setPulse(false), 700);
          setEvent((prev) => {
            if (!prev || !prev.slots) return prev;
            if (payload.eventType === 'DELETE') {
              return { ...prev, slots: prev.slots.filter((s) => s.id !== (payload.old as SlotRecord).id) };
            }
            const next = payload.new as SlotRecord;
            const hide = !!prev.settings?.hide_remaining;
            const remaining = Math.max(0, next.capacity - next.claimed_count);
            const mapped: SlotRecord = {
              ...next,
              remaining: hide ? null : remaining,
              capacity: hide ? (null as unknown as number) : next.capacity,
              claimed_count: hide ? (null as unknown as number) : next.claimed_count,
              open: remaining > 0 && !next.locked,
            };
            const exists = prev.slots.some((s) => s.id === next.id);
            const slots = exists ? prev.slots.map((s) => (s.id === next.id ? { ...s, ...mapped } : s)) : [...prev.slots, mapped];
            return { ...prev, slots };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${event.id}` },
        (payload) => {
          const next = payload.new as PublicEvent;
          setEvent((prev) => (prev ? { ...prev, locked: next.locked, status: next.status, title: next.title } : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.id, needsPin]);

  const selectedSlot = event?.slots?.find((s) => s.id === selected) || null;
  const remaining = useMemo(() => {
    if (!event?.slots) return 0;
    return event.slots.reduce((a, s) => a + Math.max(0, s.remaining ?? 0), 0);
  }, [event]);

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setPinError('Enter the access PIN.');
      return;
    }
    setPinError('');
    setLoading(true);
    const data = await load(pin.trim());
    if (!data || data.needs_pin) setPinError('That PIN is not correct.');
  };

  const continueFromNotice = () => {
    if (event?.settings?.require_notice_ack && !noticeAck) return;
    setNoticePassed(true);
  };

  const validateClaim = () => {
    if (!selected) {
      setFormError('Choose a slot first.');
      return false;
    }
    if (!name.trim() || !email.trim()) {
      setFormError('Name and email are required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid email.');
      return false;
    }
    if (event?.settings?.confirm_email && email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) {
      setFormError('Email addresses do not match.');
      return false;
    }
    if (event?.settings?.require_phone && !phone.trim()) {
      setFormError('A phone number is required.');
      return false;
    }
    setFormError('');
    return true;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateClaim()) return;
    setConfirmOpen(true);
  };

  const confirmClaim = async () => {
    if (!validateClaim() || !selected) return;
    setBusy(true);
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selected,
          participant_name: name.trim(),
          participant_email: email.trim(),
          email_confirm: emailConfirm.trim(),
          participant_phone: phone.trim(),
          notes: notes.trim(),
          pin: pin.trim(),
          notice_ack: noticeAck || noticePassed,
        }),
      });
      const data = await parseJsonSafe(res) as any;
      if (!res.ok) throw new Error(data?.error || 'Could not claim');
      setConfirmOpen(false);
      navigate(`/receipt/${data.claim_token}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not claim');
      setConfirmOpen(false);
      load(pin || undefined);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <div className="mx-auto max-w-5xl px-5 py-20">
          <div className="h-64 animate-pulse rounded-[2rem] bg-ink/5" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <div className="mx-auto max-w-lg px-5 py-24 text-center">
          <h1 className="font-display text-4xl">We couldn’t find that event</h1>
          <p className="mt-3 text-ink-soft/70">{error || 'Check the join code and try again.'}</p>
          <Link to="/join" className="btn-primary mt-8 inline-block">
            Try another code
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (needsPin) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <main className="mx-auto max-w-lg px-5 py-20">
          <div className="overflow-hidden rounded-[2rem] bg-cream shadow-xl ring-1 ring-ink/8">
            {event.cover_url && <img src={event.cover_url} alt="" className="h-40 w-full object-cover" />}
            <form onSubmit={submitPin} className="p-8">
              <p className="text-xs uppercase tracking-[0.2em] text-sage">Protected event</p>
              <h1 className="mt-2 font-display text-3xl">{event.title || 'Enter PIN'}</h1>
              <p className="mt-2 text-sm text-ink-soft/70">This event is PIN-protected. Enter the code from your organiser.</p>
              <input
                className="input-field mt-6 text-center font-mono text-2xl tracking-[0.3em]"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                maxLength={12}
                autoFocus
              />
              {pinError && <p className="mt-3 text-sm text-terra">{pinError}</p>}
              <button type="submit" className="btn-primary mt-5 w-full">
                Continue
              </button>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const hasNotice = !!(event.settings?.notice_title || event.settings?.notice_body || event.settings?.require_notice_ack);
  if (hasNotice && !noticePassed) {
    return (
      <div className="min-h-screen bg-parchment">
        <Navbar />
        <main className="mx-auto max-w-2xl px-5 py-16">
          <div className="rounded-[2rem] bg-cream p-8 ring-1 ring-ink/8 md:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-sage">Please read first</p>
            <h1 className="mt-2 font-display text-4xl">{event.settings?.notice_title || 'Before you claim'}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft/80">
              {event.settings?.notice_body || 'The organiser asked you to confirm you have read the event instructions.'}
            </p>
            {event.settings?.require_notice_ack && (
              <label className="mt-6 flex items-start gap-3 text-sm text-ink">
                <input type="checkbox" className="mt-1" checked={noticeAck} onChange={(e) => setNoticeAck(e.target.checked)} />
                I have read and understand these instructions.
              </label>
            )}
            <button
              type="button"
              onClick={continueFromNotice}
              disabled={!!event.settings?.require_notice_ack && !noticeAck}
              className="btn-primary mt-8 disabled:opacity-50"
            >
              Continue to slots
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const closed = event.locked || event.status !== 'live' || windowState(event).closed;
  const closedReason = event.locked
    ? 'This event has been immutably locked by the organiser.'
    : event.status !== 'live'
      ? 'This event is not open for claims.'
      : windowState(event).reason;

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <div className="relative h-64 overflow-hidden md:h-80">
        <img src={event.cover_url || '/images/fair.jpg'} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-parchment via-parchment/30 to-ink/20" />
      </div>
      <main className="relative z-10 mx-auto -mt-24 max-w-6xl px-5 pb-20 md:px-8">
        <div className="rounded-[2rem] bg-cream p-6 shadow-xl ring-1 ring-ink/8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {closed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] uppercase tracking-wider text-cream">
                    <Lock size={11} /> {event.locked ? 'Locked' : 'Closed'}
                  </span>
                ) : (
                  <LiveDot />
                )}
                <span className="rounded-full bg-parchment px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink/60">
                  {event.category}
                </span>
                <span className="font-mono text-xs tracking-[0.2em] text-ink/45">{event.join_code}</span>
              </div>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">{event.title}</h1>
              <p className="mt-3 max-w-2xl text-ink-soft/75">{event.description}</p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-soft/70">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={15} /> {formatDate(event.event_date, true)}
                </span>
                {event.location && (
                event.settings?.show_location_link !== false ? (
                  <a href={mapsHref(event.location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline decoration-gold/40 underline-offset-2">
                    <MapPin size={14} /> {event.location}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} /> {event.location}
                  </span>
                )
              )}
              </div>
            </div>
            {!event.settings?.hide_remaining && (
              <motion.div
                animate={pulse ? { scale: 1.04 } : { scale: 1 }}
                className="rounded-2xl bg-parchment px-5 py-4 text-right"
              >
                <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sage">
                  <Radio size={12} /> Live inventory
                </p>
                <p className="font-display text-3xl tabular-nums">{remaining}</p>
                <p className="text-xs text-ink/45">places remaining</p>
              </motion.div>
            )}
          </div>
        </div>

        {closed ? (
          <div className="mt-8 rounded-3xl bg-ink p-8 text-cream">
            <h2 className="font-display text-2xl">Claims are closed</h2>
            <p className="mt-2 text-sm text-cream/70">{closedReason}</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h2 className="font-display text-2xl">Choose a slot</h2>
              <p className="mt-1 text-sm text-ink-soft/65">Availability updates as others claim — no refresh needed.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {(event.slots || []).map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    selected={selected === slot.id}
                    onSelect={() => setSelected(slot.id)}
                  />
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <form onSubmit={submit} className="sticky top-6 rounded-[1.6rem] bg-cream p-6 ring-1 ring-ink/8">
                <h3 className="font-display text-2xl">Claim yours</h3>
                <p className="mt-1 text-sm text-ink-soft/65">
                  {selectedSlot ? (
                    <>
                      Holding <span className="text-ink">{selectedSlot.name}</span>
                    </>
                  ) : (
                    'Select a slot, then leave your details.'
                  )}
                </p>
                <div className="mt-5 space-y-3">
                  <input className="input-field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="input-field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  {event.settings?.confirm_email && (
                    <input className="input-field" type="email" placeholder="Confirm email" value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} />
                  )}
                  <input
                    className="input-field"
                    placeholder={event.settings?.require_phone ? 'Phone (required)' : 'Phone (optional)'}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {event.settings?.allow_notes !== false && (
                    <textarea
                      className="input-field min-h-[84px] resize-none"
                      placeholder="Note for the organiser (optional)"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  )}
                </div>
                <AnimatePresence>
                  {formError && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-sm text-terra">
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>
                <button type="submit" disabled={busy || !selected} className="btn-primary mt-5 w-full disabled:opacity-50">
                  {busy ? 'Securing…' : 'Confirm claim'}
                </button>
                <p className="mt-3 text-center text-[11px] text-ink/40">No account required. You’ll get a ticket you can download.</p>
              </form>
            </div>
          </div>
        )}
      </main>
      <Footer />

      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-5 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md rounded-3xl bg-cream p-7 shadow-xl"
            >
              <h3 className="font-display text-2xl">Confirm your claim?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft/75">
                You are claiming <strong className="text-ink">{selectedSlot?.name || 'this slot'}</strong> as{' '}
                <strong className="text-ink">{name.trim()}</strong> ({email.trim()}). This cannot be easily undone.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full px-4 py-2 text-sm text-ink/60"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmClaim}
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                >
                  {busy ? 'Claiming…' : 'Confirm claim'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
