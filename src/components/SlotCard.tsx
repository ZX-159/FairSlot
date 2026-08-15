import { motion } from 'framer-motion';
import type { SlotRecord } from '../lib/types';

export default function SlotCard({
  slot,
  selected,
  disabled,
  onSelect,
}: {
  slot: SlotRecord;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const hidden = slot.remaining == null || slot.capacity == null || slot.claimed_count == null;
  const remaining = hidden ? null : Math.max(0, slot.remaining ?? slot.capacity - slot.claimed_count);
  const isOpen = slot.open ?? (remaining !== null ? remaining > 0 && !slot.locked : !slot.locked);
  const full = !isOpen || slot.locked || disabled;
  const low = remaining !== null && remaining > 0 && remaining <= 2;

  return (
    <motion.button
      type="button"
      layout
      whileHover={full ? undefined : { y: -3 }}
      whileTap={full ? undefined : { scale: 0.98 }}
      onClick={() => !full && onSelect?.()}
      disabled={full}
      className={`relative w-full rounded-2xl p-4 text-left transition-shadow ${
        selected
          ? 'bg-ink text-cream shadow-lg ring-2 ring-gold/70'
          : full
            ? 'bg-parchment/70 text-ink/35 cursor-not-allowed ring-1 ring-ink/6'
            : 'bg-cream text-ink ring-1 ring-ink/8 hover:ring-moss/40 hover:shadow-[0_16px_32px_-20px_rgba(20,36,27,0.45)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] uppercase tracking-[0.16em] ${selected ? 'text-gold' : 'text-sage'}`}>
            {slot.category}
          </p>
          <h4 className="mt-1 font-display text-lg leading-snug">{slot.name}</h4>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
            selected
              ? 'bg-cream/10 text-cream'
              : full
                ? 'bg-ink/5'
                : low
                  ? 'bg-terra/10 text-terra'
                  : 'bg-moss/10 text-moss'
          }`}
        >
          {full ? (slot.locked ? 'Locked' : 'Full') : hidden ? 'Open' : `${remaining} left`}
        </span>
      </div>
      {slot.description && (
        <p className={`mt-2 text-sm leading-relaxed ${selected ? 'text-cream/70' : 'text-ink-soft/70'}`}>
          {slot.description}
        </p>
      )}
      {!hidden && (
        <>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-current/10">
            <motion.div
              className={`h-full ${selected ? 'bg-gold' : full ? 'bg-ink/20' : 'bg-moss'}`}
              initial={false}
              animate={{ width: `${Math.min(100, (slot.claimed_count / Math.max(1, slot.capacity)) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className={`mt-2 text-[11px] tabular-nums ${selected ? 'text-cream/50' : 'text-ink/40'}`}>
            {slot.claimed_count} / {slot.capacity} claimed
          </p>
        </>
      )}
    </motion.button>
  );
}
