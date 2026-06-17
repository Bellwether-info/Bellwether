// Central configuration. Refresh cadence and provider keys come from env;
// everything has a low-frequency default so the background job stays gentle.

export const PORT = process.env.PORT || 8787;

// Allowed CORS origin for the front end. '*' is fine for personal use;
// set ORIGIN to your app's URL to lock it down.
export const ORIGIN = process.env.ORIGIN || '*';

// Trading Economics API key. Without it the server still serves World Bank
// macro history and a basic annual actual/prior report; the economic calendar
// and monthly consensus-vs-actual light up once a key is present.
// A free guest key ('guest:guest') exists but only covers a few countries.
export const TE_KEY = process.env.TE_KEY || '';

// --- Background refresh schedule (cron). Defaults are deliberately low. ---
// Macro history (World Bank) changes rarely: once a day is already generous.
export const MACRO_CRON = process.env.MACRO_CRON || '15 6 * * *';      // 06:15 daily
// Calendar / consensus (Trading Economics): twice a day catches new prints.
export const CALENDAR_CRON = process.env.CALENDAR_CRON || '30 6,18 * * *'; // 06:30 and 18:30
// Delay between upstream calls during a refresh, to respect rate limits (ms).
export const STAGGER_MS = Number(process.env.STAGGER_MS || 900);
// Warm the cache this many ms after boot (so a fresh deploy has data soon).
export const WARM_DELAY_MS = Number(process.env.WARM_DELAY_MS || 8000);

// Economies with a major stock index. `te` is the Trading Economics country slug.
export const ECONOMIES = [
  { iso:'USA', name:'United States', index:'S&P 500 / Dow Jones', te:'united states', source:'U.S. BLS, BEA & Federal Reserve' },
  { iso:'AUS', name:'Australia', index:'S&P/ASX 200', te:'australia', source:'Australian Bureau of Statistics & RBA' },
  { iso:'GBR', name:'United Kingdom', index:'FTSE 100', te:'united kingdom', source:'UK ONS & Bank of England' },
  { iso:'DEU', name:'Germany', index:'DAX', te:'germany', source:'Destatis & ECB' },
  { iso:'FRA', name:'France', index:'CAC 40', te:'france', source:'INSEE & Banque de France' },
  { iso:'JPN', name:'Japan', index:'Nikkei 225', te:'japan', source:'Japan Statistics Bureau & Bank of Japan' },
  { iso:'CHN', name:'China', index:'CSI 300 / SSE', te:'china', source:'China NBS & PBoC' },
  { iso:'HKG', name:'Hong Kong', index:'Hang Seng', te:'hong kong', source:'Hong Kong C&SD & HKMA' },
  { iso:'IND', name:'India', index:'Nifty 50 / Sensex', te:'india', source:'India MOSPI & RBI' },
  { iso:'CAN', name:'Canada', index:'S&P/TSX', te:'canada', source:'Statistics Canada & Bank of Canada' },
  { iso:'KOR', name:'South Korea', index:'KOSPI', te:'south korea', source:'Statistics Korea & Bank of Korea' },
  { iso:'BRA', name:'Brazil', index:'Ibovespa', te:'brazil', source:'IBGE & Banco Central do Brasil' },
  { iso:'CHE', name:'Switzerland', index:'SMI', te:'switzerland', source:'Swiss Federal Statistical Office & SNB' },
  { iso:'NLD', name:'Netherlands', index:'AEX', te:'netherlands', source:'CBS Netherlands & ECB' },
  { iso:'ESP', name:'Spain', index:'IBEX 35', te:'spain', source:'INE Spain & Banco de España' },
  { iso:'ITA', name:'Italy', index:'FTSE MIB', te:'italy', source:"ISTAT & Banca d'Italia" },
  { iso:'MEX', name:'Mexico', index:'S&P/BMV IPC', te:'mexico', source:'INEGI & Banco de México' },
  { iso:'ZAF', name:'South Africa', index:'JSE Top 40', te:'south africa', source:'Statistics South Africa & SARB' },
  { iso:'SGP', name:'Singapore', index:'Straits Times', te:'singapore', source:'SingStat & MAS' },
  { iso:'SAU', name:'Saudi Arabia', index:'Tadawul All Share', te:'saudi arabia', source:'GASTAT & SAMA' },
  { iso:'IDN', name:'Indonesia', index:'IDX Composite', te:'indonesia', source:'Statistics Indonesia (BPS) & Bank Indonesia' }
];

// World Bank indicator codes shown in the app.
export const INDICATORS = [
  { code:'FP.CPI.TOTL.ZG', name:'Inflation, consumer prices', unit:'% annual', fmt:'pct' },
  { code:'NY.GDP.MKTP.KD.ZG', name:'GDP growth', unit:'% annual', fmt:'pct' },
  { code:'NY.GDP.MKTP.CD', name:'GDP (current US$)', unit:'US$', fmt:'money' },
  { code:'NY.GDP.PCAP.CD', name:'GDP per capita', unit:'US$', fmt:'usd0' },
  { code:'SL.UEM.TOTL.ZS', name:'Unemployment rate', unit:'% labour force', fmt:'pct' },
  { code:'FR.INR.RINR', name:'Real interest rate', unit:'%', fmt:'pct' },
  { code:'BN.CAB.XOKA.GD.ZS', name:'Current account balance', unit:'% of GDP', fmt:'pct' },
  { code:'NE.EXP.GNFS.ZS', name:'Exports of goods & services', unit:'% of GDP', fmt:'pct' },
  { code:'GC.DOD.TOTL.GD.ZS', name:'Central govt debt', unit:'% of GDP', fmt:'pct' },
  { code:'SP.POP.TOTL', name:'Population', unit:'people', fmt:'int' }
];

// Map a World Bank indicator to the Trading Economics calendar categories that
// represent the same release. Used to build the consensus-vs-actual report from
// calendar events. Indicators not listed here fall back to the World Bank annual
// figure (actual + prior, no consensus).
export const TE_CATEGORY = {
  'FP.CPI.TOTL.ZG': ['inflation rate'],
  'NY.GDP.MKTP.KD.ZG': ['gdp growth rate', 'gdp annual growth rate'],
  'SL.UEM.TOTL.ZS': ['unemployment rate']
};

export const econByIso = iso => ECONOMIES.find(e => e.iso === iso);
export const indByCode = code => INDICATORS.find(i => i.code === code);
