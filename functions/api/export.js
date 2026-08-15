import handler from '../../api/export.js';
import { asPages } from '../_lib/asPages.js';

export const onRequest = asPages(handler);
