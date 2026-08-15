import type { EventSettings } from './types';

export const defaultSettings = (): EventSettings => ({
  join_pin: '',
  require_phone: false,
  one_per_email: false,
  confirm_email: false,
  hide_remaining: false,
  unlisted: false,
  require_notice_ack: false,
  claim_opens_at: null,
  claim_closes_at: null,
  notice_title: '',
  notice_body: '',
  success_title: '',
  success_message: '',
  ticket_note: '',
});

export function toLocalInput(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
