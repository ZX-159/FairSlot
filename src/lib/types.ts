export type EventStatus = 'draft' | 'live' | 'closed';

export interface EventSettings {
  event_id?: number;
  join_pin: string;
  require_phone: boolean;
  one_per_email: boolean;
  confirm_email: boolean;
  hide_remaining: boolean;
  unlisted: boolean;
  require_notice_ack: boolean;
  allow_notes: boolean;
  show_location_link: boolean;
  claim_opens_at: string | null;
  claim_closes_at: string | null;
  notice_title: string;
  notice_body: string;
  success_title: string;
  success_message: string;
  ticket_note: string;
  pin_required?: boolean;
}

export interface EventRecord {
  id: number;
  creator_id: string;
  title: string;
  description: string;
  location: string;
  event_date: string | null;
  cover_url: string;
  category: string;
  status: EventStatus;
  join_code: string;
  locked: boolean;
  created_at: string;
  slot_count?: number;
  capacity?: number | null;
  claimed?: number | null;
  fill?: number;
  settings?: EventSettings;
  share_path?: string;
}

export interface SlotRecord {
  id: number;
  event_id: number;
  name: string;
  description: string;
  category: string;
  capacity: number;
  claimed_count: number;
  remaining?: number | null;
  open?: boolean;
  sort_order: number;
  locked: boolean;
  created_at?: string;
}

export interface ClaimRecord {
  id: number;
  slot_id: number;
  event_id: number;
  participant_name: string;
  participant_email: string;
  participant_phone: string;
  notes: string;
  claim_token: string;
  created_at: string;
  slot_name?: string;
  event_title?: string;
  join_code?: string;
}

export interface PublicEvent extends Omit<EventRecord, 'creator_id'> {
  slots: SlotRecord[];
  needs_pin?: boolean;
  pin_required?: boolean;
  settings?: EventSettings;
}

export interface DashboardPayload {
  events: EventRecord[];
  recentClaims: Pick<ClaimRecord, 'id' | 'event_id' | 'slot_id' | 'participant_name' | 'created_at'>[];
}
