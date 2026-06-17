import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import {
  PORT, ORIGIN, TE_KEY, MACRO_CRON, CALENDAR_CRON, STAGGER_MS, WARM_DELAY_MS,
  ECONOMIES, INDICATORS, econByIso, indByCode
} from './src/config.js';
import { cache, persist } from './src/cache.js';
import {
  fetchWorldBank, fetchTECalendar, buildCalendar, buildReport
} from './src/providers.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => new Date().toISOString();

// ---------------- background refresh ----------------
let refreshing = false;

async function refreshMacro() {
  console.log(`[${now()}] macro refresh: start (${ECONOMIES.length}x${INDICATORS.length})`);
  let ok = 0, fail = 0;
  for (const e of ECONOMIES) {
    for (const ind of INDICATORS) {
      const key = `${e.iso}:${ind.code}`;
      try {
        const d = await fetchWorldBank(e.iso, ind.code);
        cache.macro[key] = { ...d, source: e.source, fetchedAt: now() };
        ok++;
      } catch (err) {
        fail++; // keep any previously cached value; just skip
      }
      persist();
      await sleep(STAGGER_MS);
    }
  }
  cache.refreshedAt.macro = now();
  persist();
  console.log(`[${now()}] macro refresh: done (ok ${ok}, fail ${fail})`);
}

async function refreshCalendar() {
  if (!TE_KEY) { console.log(`[${now()}] calendar refresh: skipped (no TE_KEY)`); return; }
  console.log(`[${now()}] calendar refresh: start (${ECONOMIES.length})`);
  let ok = 0, fail = 0;
  for (const e of ECONOMIES) {
    try {
      const items = await fetchTECalendar(e.te);
      if (items) { cache.events[e.iso] = { items, fetchedAt: now() }; ok++; }
    } catch (err) {
      fail++;
    }
    persist();
    await sleep(STAGGER_MS);
  }
  cache.refreshedAt.calendar = now();
  persist();
  console.log(`[${now()}] calendar refresh: done (ok ${ok}, fail ${fail})`);
}

async function refreshAll() {
  if (refreshing) { console.log('[refresh] already running, skip'); return; }
  refreshing = true;
  try { await refreshMacro(); await refreshCalendar(); }
  finally { refreshing = false; }
}

// ---------------- API ----------------
const app = express();
app.use(cors({ origin: ORIGIN }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    refreshedAt: cache.refreshedAt,
    teConfigured: !!TE_KEY,
    macroKeys: Object.keys(cache.macro).length,
    calendarCountries: Object.keys(cache.events).length,
    refreshing
  });
});

app.get('/api/meta', (_req, res) => {
  res.json({ economies: ECONOMIES, indicators: INDICATORS, refreshedAt: cache.refreshedAt });
});

app.get('/api/macro/:iso/:code', (req, res) => {
  const { iso, code } = req.params;
  const econ = econByIso(iso); const ind = indByCode(code);
  if (!econ || !ind) return res.status(404).json({ error: 'unknown economy or indicator' });
  const hit = cache.macro[`${iso}:${code}`];
  if (!hit) return res.status(503).json({ error: 'not cached yet', note: 'background refresh has not populated this series. Try again shortly.' });
  res.json({ iso, code, name: ind.name, unit: ind.unit, fmt: ind.fmt,
    series: hit.series, latest: hit.latest, source: hit.source, fetchedAt: hit.fetchedAt });
});

app.get('/api/calendar/:iso', (req, res) => {
  const { iso } = req.params;
  const econ = econByIso(iso);
  if (!econ) return res.status(404).json({ error: 'unknown economy' });
  const ev = cache.events[iso];
  if (!ev) {
    return res.json({ iso, items: [], source: econ.source,
      note: TE_KEY ? 'No calendar cached yet; refresh pending.' : 'Economic calendar requires a Trading Economics key (set TE_KEY).' });
  }
  res.json({ iso, items: buildCalendar(ev.items), source: econ.source, fetchedAt: ev.fetchedAt });
});

app.get('/api/report/:iso/:code', (req, res) => {
  const { iso, code } = req.params;
  const econ = econByIso(iso); const ind = indByCode(code);
  if (!econ || !ind) return res.status(404).json({ error: 'unknown economy or indicator' });
  const ev = cache.events[iso];
  const macro = cache.macro[`${iso}:${code}`];
  const report = buildReport(iso, code, ev ? ev.items : null, macro, econ);
  if (!report) return res.status(503).json({ error: 'no data cached yet' });
  res.json({ iso, code, ...report });
});

// manual trigger (handy after deploy): POST /api/refresh
app.post('/api/refresh', (_req, res) => { refreshAll(); res.json({ started: true }); });

app.listen(PORT, () => {
  console.log(`[${now()}] Bellwether server on :${PORT}  (TE ${TE_KEY ? 'configured' : 'not set'})`);
  console.log(`  macro cron:    ${MACRO_CRON}`);
  console.log(`  calendar cron: ${CALENDAR_CRON}`);
  // warm the cache shortly after boot if it's empty
  setTimeout(() => { if (Object.keys(cache.macro).length === 0) refreshAll(); }, WARM_DELAY_MS);
});

// schedule the low-frequency background refreshes
cron.schedule(MACRO_CRON, () => refreshMacro().catch(e => console.error('macro cron', e.message)));
cron.schedule(CALENDAR_CRON, () => refreshCalendar().catch(e => console.error('calendar cron', e.message)));
