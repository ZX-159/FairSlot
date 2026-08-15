import handler from '../../api/events.js';
import { asPages } from '../_lib/asPages.js';

export const onRequest = asPages(handler);
