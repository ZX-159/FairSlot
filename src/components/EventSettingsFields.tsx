import type { EventSettings } from '../lib/types';
import { toLocalInput } from '../lib/settings';

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-parchment/70 px-4 py-3 ring-1 ring-ink/6">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft/65">{hint}</span>
      </span>
      <span className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-moss' : 'bg-ink/15'}`}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-cream shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </span>
    </label>
  );
}

export default function EventSettingsFields({
  value,
  onChange,
  disabled,
}: {
  value: EventSettings;
  onChange: (next: EventSettings) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<EventSettings>) => onChange({ ...value, ...patch });

  return (
    <div className={`space-y-8 ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-sage">Security</p>
        <h3 className="mt-1 font-display text-2xl">Access & integrity</h3>
        <div className="mt-4 space-y-2">
          <label className="block rounded-2xl bg-parchment/70 px-4 py-3 ring-1 ring-ink/6">
            <span className="block text-sm font-medium text-ink">Access PIN</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft/65">
              Optional. Participants must enter this after opening the share link or join code.
            </span>
            <input
              className="input-field mt-3 font-mono tracking-[0.22em]"
              placeholder="Leave blank for open access"
              value={value.join_pin}
              onChange={(e) => set({ join_pin: e.target.value })}
              maxLength={12}
              autoComplete="off"
            />
          </label>
          <Toggle
            label="Require phone number"
            hint="Claims are rejected unless a phone number is provided."
            checked={value.require_phone}
            onChange={(v) => set({ require_phone: v })}
          />
          <Toggle
            label="One claim per email"
            hint="The same email cannot hold more than one slot on this event."
            checked={value.one_per_email}
            onChange={(v) => set({ one_per_email: v })}
          />
          <Toggle
            label="Confirm email"
            hint="Participants must type their email twice. Mismatches are rejected."
            checked={value.confirm_email}
            onChange={(v) => set({ confirm_email: v })}
          />
          <Toggle
            label="Hide remaining counts"
            hint="Public view shows Open or Full only — never exact inventory."
            checked={value.hide_remaining}
            onChange={(v) => set({ hide_remaining: v })}
          />
          <Toggle
            label="Unlisted event"
            hint="Hidden from the public directory. Share link and join code still work."
            checked={value.unlisted}
            onChange={(v) => set({ unlisted: v })}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Claims open</span>
            <input
              type="datetime-local"
              className="input-field"
              value={toLocalInput(value.claim_opens_at)}
              onChange={(e) => set({ claim_opens_at: e.target.value || null })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Claims close</span>
            <input
              type="datetime-local"
              className="input-field"
              value={toLocalInput(value.claim_closes_at)}
              onChange={(e) => set({ claim_closes_at: e.target.value || null })}
            />
          </label>
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-sage">Pre-notice</p>
        <h3 className="mt-1 font-display text-2xl">Instructions before claiming</h3>
        <p className="mt-1 text-sm text-ink-soft/65">Shown after the PIN (if any) and before slot selection.</p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Notice title</span>
          <input
            className="input-field"
            value={value.notice_title}
            onChange={(e) => set({ notice_title: e.target.value })}
            placeholder="Before you claim"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Instructions</span>
          <textarea
            className="input-field min-h-[140px] resize-none"
            value={value.notice_body}
            onChange={(e) => set({ notice_body: e.target.value })}
            placeholder="Arrival time, what to bring, eligibility, cancellation policy…"
          />
        </label>
        <div className="mt-3">
          <Toggle
            label="Require acknowledgement"
            hint="Participants must confirm they have read the instructions before continuing."
            checked={value.require_notice_ack}
            onChange={(v) => set({ require_notice_ack: v })}
          />
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-[0.18em] text-sage">Success & ticket</p>
        <h3 className="mt-1 font-display text-2xl">After a claim</h3>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Success title</span>
          <input
            className="input-field"
            value={value.success_title}
            onChange={(e) => set({ success_title: e.target.value })}
            placeholder="You’re in."
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Success message</span>
          <textarea
            className="input-field min-h-[100px] resize-none"
            value={value.success_message}
            onChange={(e) => set({ success_message: e.target.value })}
            placeholder="Your slot is reserved. Download your ticket and keep the reference."
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-ink/45">Ticket footnote</span>
          <input
            className="input-field"
            value={value.ticket_note}
            onChange={(e) => set({ ticket_note: e.target.value })}
            placeholder="Present this ticket at the door."
          />
        </label>
      </section>
    </div>
  );
}
