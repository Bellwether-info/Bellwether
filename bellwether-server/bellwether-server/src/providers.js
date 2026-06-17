// Upstream data providers and the helpers that turn raw responses into the
// shapes the front end expects.
import { TE_KEY, TE_CATEGORY, indByCode } from './config.js';

const num = v => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
};

// ---------- World Bank: historical annual series (free, no key) ----------
export async function fetchWorldBank(iso, code) {
  const url = `https://api.worldbank.org/v2/country/${iso}/indicator/${code}?format=json&per_page=70&date=1995:2026`;
  const res = await fetch(url, { headers: { 'User-Agent': 'bellwether-server' } });
  if (!res.ok) throw new Error(`World Bank ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json) || json.length < 2 || !json[1]) throw new Error('no-series');
  const series = json[1]
    .filter(d => d.value !== null)
    .map(d => ({ y: +d.date, v: +d.value }))
    .sort((a, b) => a.y - b.y);
  if (series.length === 0) throw new Error('no-data');
  const latest = series[series.length - 1];
  const prior = series.length > 1 ? series[series.length - 2] : null;
  return { series, latest, prior };
}

// ---------- Trading Economics: calendar (paid / guest key) ----------
// One call per country returns recent + upcoming events, each carrying
// Actual / Forecast / Previous, which feeds both the calendar and the report.
export async function fetchTECalendar(teCountry) {
  if (!TE_KEY) return null;
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() - 45);
  const d2 = new Date(today); d2.setDate(d2.getDate() + 30);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `https://api.tradingeconomics.com/calendar/country/${encodeURIComponent(teCountry)}`
    + `/${fmt(d1)}/${fmt(d2)}?c=${encodeURIComponent(TE_KEY)}&f=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'bellwether-server' } });
  if (!res.ok) throw new Error(`Trading Economics ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) return [];
  return raw.map(e => ({
    date: (e.Date || '').slice(0, 10),
    time: (e.Date || '').slice(11, 16) || 'TBD',
    event: e.Event || e.Category || 'Release',
    category: (e.Category || '').toLowerCase(),
    reference: e.Reference || '',
    importance: e.Importance === 3 ? 'high' : e.Importance === 1 ? 'low' : 'medium',
    actual: e.Actual ?? '',
    forecast: e.Forecast ?? '',
    previous: e.Previous ?? '',
    source: 'Trading Economics',
    url: e.SourceURL || e.Source || ''
  }));
}

// ---------- Derive the front-end shapes ----------

// Upcoming + very recent events, soonest first.
export function buildCalendar(events) {
  if (!events) return [];
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 3);
  return events
    .filter(e => e.date && new Date(e.date) >= cutoff)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 12)
    .map(e => ({
      date: e.date, time: e.time, event: e.event, importance: e.importance,
      consensus: e.forecast, prior: e.previous, actual: e.actual,
      source: e.source, url: e.url
    }));
}

// Most recent released event matching the indicator -> expected vs actual.
export function buildReport(iso, code, events, macro, econ) {
  const ind = indByCode(code);
  const cats = TE_CATEGORY[code];
  if (events && cats) {
    const match = events
      .filter(e => e.actual !== '' && e.actual !== null && cats.some(c => e.category.includes(c)))
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (match) {
      const a = num(match.actual), f = num(match.forecast);
      let verdict = 'n/a';
      if (a !== null && f !== null) verdict = a > f ? 'above' : a < f ? 'below' : 'in line';
      const surprise = (a !== null && f !== null && a !== f)
        ? `Actual ${match.actual} vs forecast ${match.forecast}` : '';
      return {
        period: match.reference || match.date,
        actual: String(match.actual),
        expected: match.forecast === '' ? '' : String(match.forecast),
        prior: match.previous === '' ? '' : String(match.previous),
        verdict, surprise, note: '',
        source: 'Trading Economics', url: match.url || '',
        basis: 'calendar'
      };
    }
  }
  // Fallback: World Bank annual figure (actual + prior, no consensus).
  if (macro && macro.latest) {
    return {
      period: String(macro.latest.y),
      actual: `${macro.latest.v} ${ind ? ind.unit : ''}`.trim(),
      expected: '',
      prior: macro.prior ? `${macro.prior.v} ${ind ? ind.unit : ''}`.trim() : '',
      verdict: 'n/a', surprise: '', note: 'Annual figure from World Bank; no consensus forecast for this series.',
      source: econ ? econ.source : 'World Bank', url: '',
      basis: 'worldbank-annual'
    };
  }
  return null;
}
