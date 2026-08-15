import handler from '../../api/claims.js';
import { asPages } from '../_lib/asPages.js';

export const onRequest = asPages(handler);
