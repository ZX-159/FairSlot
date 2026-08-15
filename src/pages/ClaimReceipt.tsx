import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Calendar, MapPin, Download } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { formatDate } from '../lib/api';
import { downloadTicket } from '../lib/ticket';
import type { ClaimRecord, EventRecord, EventSettings, SlotRecord } from '../lib/types';

export default function ClaimReceipt() {
  const { token = '' } = useParams();
  const [payload, setPayload] = useState<{
    claim: ClaimRecord;
    event: EventRecord & { settings?: EventSettings };
    slot: SlotRecord;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/public?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Receipt not found');
        setPayload(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Receipt not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const saveTicket = () => {
    if (!payload) return;
    downloadTicket({
      eventTitle: payload.event.title,
      slotName: payload.slot.name,
      participantName: payload.claim.participant_name,
      email: payload.claim.participant_email,
      dateLabel: formatDate(payload.event.event_date, true),
      location: payload.event.location || '',
      joinCode: payload.event.join_code,
      ref: payload.claim.claim_token,
      note: payload.event.settings?.ticket_note || '',
    });
  };

  return (
    <div className="min-h-screen bg-parchment">
      <Navbar />
      <main className="mx-auto max-w-xl px-5 py-16 md:px-8">
        {loading ? (
          <div className="h-80 animate-pulse rounded-[2rem] bg-ink/5" />
        ) : error || !payload ? (
          <div className="text-center">
            <h1 className="font-display text-4xl">Receipt not found</h1>
            <p className="mt-3 text-ink-soft/70">{error}</p>
            <Link to="/join" className="btn-primary mt-6 inline-block">
              Join an event
            </Link>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[2rem] bg-cream shadow-xl ring-1 ring-ink/8">
            <div className="bg-moss px-8 py-8 text-cream">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-cream/15">
                <Check />
              </div>
              <h1 className="mt-4 font-display text-3xl">{payload.event.settings?.success_title || 'You’re in.'}</h1>
              <p className="mt-1 text-sm text-cream/75">
                {payload.event.settings?.success_message || 'Your slot is reserved. Download your ticket and keep the reference.'}
              </p>
            </div>
            <div className="space-y-4 px-8 py-8">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-sage">Event</p>
                <p className="font-display text-2xl">{payload.event.title}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-sage">Slot</p>
                <p className="text-lg">{payload.slot.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-ink-soft/75">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} /> {formatDate(payload.event.event_date, true)}
                </span>
                {payload.event.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} /> {payload.event.location}
                  </span>
                )}
              </div>
              <div className="rounded-2xl bg-parchment p-4 text-sm">
                <p className="font-medium">{payload.claim.participant_name}</p>
                <p className="text-ink-soft/70">{payload.claim.participant_email}</p>
                {payload.claim.participant_phone && <p className="text-ink-soft/70">{payload.claim.participant_phone}</p>}
              </div>
              {payload.event.settings?.ticket_note && (
                <p className="text-sm italic text-ink-soft/70">{payload.event.settings.ticket_note}</p>
              )}
              <p className="text-center font-mono text-xs tracking-[0.2em] text-ink/40">REF {payload.claim.claim_token.toUpperCase()}</p>
              <button type="button" onClick={saveTicket} className="btn-primary flex w-full items-center justify-center gap-2">
                <Download size={16} /> Download ticket
              </button>
              <Link to={`/e/${payload.event.join_code}`} className="block text-center text-sm text-ink-soft/70 underline decoration-gold/50 underline-offset-4">
                Back to event
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <Footer />
    </div>
  );
}
