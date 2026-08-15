import handler from '../../api/slots.js';
import { asPages } from '../_lib/asPages.js';

export const onRequest = asPages(handler);
