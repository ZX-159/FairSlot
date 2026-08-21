import { Link } from 'react-router-dom';
import { MapPin, Calendar, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { EventRecord } from '../lib/types';
import { formatDate } from '../lib/api';
import LiveDot from './LiveDot';

export default function EventCard({
  event,
  href,
  showCode = true,
}: {
  event: EventRecord;
  href: string;
  showCode?: boolean;
}) {
  const fill = Math.round((event.fill || 0) * 100);
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className="group overflow-hidden rounded-3xl bg-cream shadow-[0_1px_0_rgba(20,36,27,0.06),0_18px_40px_-24px_rgba(20,36,27,0.35)] ring-1 ring-ink/6"
    >
      <Link to={href} className="block">
        <div className="relative h-44 overflow-hidden">
          <img
            src={event.cover_url || '/images/fair.jpg'}
            alt=""
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent" />
          <div className="absolute left-4 top-4 flex items-center gap-2">
            {event.locked ? (
              <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] uppercase tracking-wider text-cream">Locked</span>
            ) : event.status === 'live' ? (
              <LiveDot />
            ) : (
              <span className="rounded-full bg-cream/95 px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink/70">
                {event.status || 'draft'}
              </span>
            )}
            <span className="rounded-full bg-cream/90 px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink">
              {event.category}
            </span>
          </div>
          {showCode && (
            <span className="absolute bottom-4 right-4 rounded-lg bg-cream/95 px-2.5 py-1 font-mono text-xs tracking-[0.18em] text-ink">
              {event.join_code}
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-xl leading-snug text-ink">{event.title}</h3>
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink/30 transition-colors group-hover:text-terra" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft/70">
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} /> {formatDate(event.event_date)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} /> {event.location}
              </span>
            )}
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-ink-soft/60">
              <span>Inventory</span>
              <span>
                {event.capacity == null ? 'Live' : `${event.claimed || 0}/${event.capacity} claimed`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-moss to-leaf transition-all duration-700"
                style={{ width: event.capacity == null ? '100%' : `${Math.min(100, fill)}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
