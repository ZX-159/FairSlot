import handler from '../../api/public.js';
import { asPages } from '../_lib/asPages.js';

export const onRequest = asPages(handler);
