// Simple in-memory cache with JSON file persistence, so a restart keeps the
// last good data and the app never waits on a cold provider call.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'cache.json');

const empty = {
  refreshedAt: { macro: null, calendar: null },
  macro: {},     // key `${iso}:${code}` -> { series, latest, prior, source, fetchedAt }
  events: {}     // key iso -> { items:[...], fetchedAt }
};

export const cache = existsSync(FILE)
  ? Object.assign(structuredClone(empty), JSON.parse(readFileSync(FILE, 'utf8')))
  : structuredClone(empty);

let pending = null;
export function persist() {
  // debounce disk writes during a bulk refresh
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    try { writeFileSync(FILE, JSON.stringify(cache)); }
    catch (e) { console.error('[cache] write failed:', e.message); }
  }, 500);
}
