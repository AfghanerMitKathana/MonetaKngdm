import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");
const frontendDir = join(projectRoot, "frontend");
const dataDir = join(__dirname, "data");
const dataFile = join(dataDir, "store.json");
const PORT = Number(process.env.PORT) || 3000;

loadEnvFile(join(projectRoot, ".env"));
loadEnvFile(join(__dirname, ".env"));

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";
const QUOTE_CACHE_MS = 15 * 60 * 1000;
const HISTORY_CACHE_MS = 30 * 60 * 1000;
const ALPHA_DELAY_MS = 1200;
const quoteCache = new Map();
const historyCache = new Map();
let lastAlphaRequestAt = 0;

const symbolAliases = {
  A422EZ: "Y0N",
  REDWOODAI: "Y0N",
  "REDWOOD-AI": "Y0N"
};

const defaultStore = {
  watchlist: [
    { symbol: "AAPL", name: "Apple", sector: "Technologie" },
    { symbol: "NVDA", name: "NVIDIA", sector: "Halbleiter" },
    { symbol: "TSLA", name: "Tesla", sector: "Automobil" }
  ],
  alerts: [
    { id: randomUUID(), symbol: "AAPL", direction: "above", target: 215, active: true, triggered: false },
    { id: randomUUID(), symbol: "ASML", direction: "below", target: 930, active: true, triggered: false }
  ]
};

const fallbackNames = {
  AAPL: { name: "Apple", sector: "Technologie", currency: "$", stooq: "aapl.us" },
  NVDA: { name: "NVIDIA", sector: "Halbleiter", currency: "$", stooq: "nvda.us" },
  TSLA: { name: "Tesla", sector: "Automobil", currency: "$", stooq: "tsla.us" },
  MSFT: { name: "Microsoft", sector: "Software", currency: "$", stooq: "msft.us" },
  AMZN: { name: "Amazon", sector: "E-Commerce", currency: "$", stooq: "amzn.us" },
  ASML: { name: "ASML", sector: "Halbleiter", currency: "$", stooq: "asml.us" },
  RHM: { name: "Rheinmetall", sector: "Industrie", currency: "EUR", stooq: "rhm.de" },
  Y0N: { name: "Redwood AI", sector: "KI/Chemie", currency: "EUR", stooq: "y0n.de", yahoo: "Y0N.F" },
  AIRX: { name: "Redwood AI", sector: "KI/Chemie", currency: "CAD", yahoo: "AIRX.CN" },
  RDWCF: { name: "Redwood AI", sector: "KI/Chemie", currency: "$", stooq: "rdwcf.us", yahoo: "RDWCF" },
  SPY: { name: "S&P 500", sector: "Indexfonds", currency: "$", stooq: "spy.us" },
  QQQ: { name: "NASDAQ 100", sector: "Indexfonds", currency: "$", stooq: "qqq.us" },
  DIA: { name: "Dow Jones", sector: "Indexfonds", currency: "$", stooq: "dia.us" },
  IWM: { name: "Russell 2000", sector: "Indexfonds", currency: "$", stooq: "iwm.us" },
  VOO: { name: "Vanguard S&P 500 ETF", sector: "ETF", currency: "$", stooq: "voo.us" },
  EWG: { name: "iShares Germany ETF", sector: "ETF", currency: "$", stooq: "ewg.us" },
  GLD: { name: "Gold ETF", sector: "ETF", currency: "$", stooq: "gld.us" },
  "ENR.DEX": { name: "Siemens Energy", sector: "Industrie", currency: "EUR", stooq: "enr.de" }
};

const demoQuotes = {
  AAPL: quote("AAPL", "Apple", 212.48, 2.14, "$", "Technologie", "34,7 Mio.", "demo"),
  NVDA: quote("NVDA", "NVIDIA", 924.37, 3.62, "$", "Halbleiter", "48,2 Mio.", "demo"),
  TSLA: quote("TSLA", "Tesla", 168.92, -1.08, "$", "Automobil", "71,5 Mio.", "demo"),
  MSFT: quote("MSFT", "Microsoft", 428.17, 1.12, "$", "Software", "24,1 Mio.", "demo"),
  AMZN: quote("AMZN", "Amazon", 186.44, 0.78, "$", "E-Commerce", "31,8 Mio.", "demo"),
  ASML: quote("ASML", "ASML", 944.10, -0.42, "$", "Halbleiter", "1,2 Mio.", "demo"),
  Y0N: quote("Y0N", "Redwood AI", 4.26, 2.65, "EUR", "KI/Chemie", "-", "demo"),
  AIRX: quote("AIRX", "Redwood AI", 4.26, 2.65, "CAD", "KI/Chemie", "-", "demo"),
  RDWCF: quote("RDWCF", "Redwood AI", 3.57, 0, "$", "KI/Chemie", "-", "demo"),
  SPY: quote("SPY", "S&P 500", 511.42, 0.64, "$", "Indexfonds", "62,4 Mio.", "demo"),
  QQQ: quote("QQQ", "NASDAQ 100", 442.18, 0.91, "$", "Indexfonds", "44,8 Mio.", "demo"),
  DIA: quote("DIA", "Dow Jones", 389.72, 0.28, "$", "Indexfonds", "3,9 Mio.", "demo"),
  IWM: quote("IWM", "Russell 2000", 203.56, -0.18, "$", "Indexfonds", "26,3 Mio.", "demo"),
  VOO: quote("VOO", "Vanguard S&P 500 ETF", 470.88, 0.62, "$", "ETF", "5,7 Mio.", "demo"),
  EWG: quote("EWG", "iShares Germany ETF", 31.42, 0.35, "$", "ETF", "1,1 Mio.", "demo"),
  GLD: quote("GLD", "Gold ETF", 216.33, -0.24, "$", "ETF", "8,4 Mio.", "demo"),
  "ENR.DEX": quote("ENR.DEX", "Siemens Energy", 22.61, 2.98, "EUR", "Industrie", "4,7 Mio.", "demo")
};

const demoNews = [
  {
    title: "Tech-Aktien fuehren den Markt an",
    summary: "Starke Unternehmenszahlen und positive Analystenkommentare treiben grosse Technologie-Werte an.",
    category: "Technologie",
    time: "Beispiel"
  },
  {
    title: "DAX behauptet Tagesgewinne",
    summary: "Der deutsche Leitindex bleibt im Plus, getragen von Industrie- und Energieunternehmen.",
    category: "Europa",
    time: "Beispiel"
  },
  {
    title: "US-Markt wartet auf Konjunkturdaten",
    summary: "Anleger richten den Blick auf kommende Wirtschaftsdaten und moegliche Auswirkungen auf Zinserwartungen.",
    category: "Makro",
    time: "Beispiel"
  }
];

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/health") {
      return sendJson(response, {
        ok: true,
        usesRealApi: Boolean(ALPHA_VANTAGE_API_KEY),
        apiKeyFound: Boolean(ALPHA_VANTAGE_API_KEY)
      });
    }

    if (url.pathname === "/api/state") {
      const store = await readStore();
      return sendJson(response, store);
    }

    if (url.pathname === "/api/watchlist") {
      if (request.method === "POST") return addWatchlistItem(request, response);
      if (request.method === "DELETE") return removeWatchlistItem(request, response);
    }

    if (url.pathname === "/api/alerts") {
      if (request.method === "POST") return addAlert(request, response);
      if (request.method === "PATCH") return updateAlert(request, response);
      if (request.method === "DELETE") return removeAlert(request, response);
    }

    if (url.pathname === "/api/quotes") {
      const store = await readStore();
      const requestedSymbols = url.searchParams.get("symbols");
      const symbols = requestedSymbols
        ? parseSymbols(requestedSymbols)
        : uniqueSymbols([...store.watchlist.map((item) => item.symbol), "MSFT", "AMZN", "ASML", "ENR.DEX"]);

      const quotes = [];
      for (const symbol of symbols) {
        quotes.push(await getQuote(symbol));
      }
      return sendJson(response, {
        source: getQuoteResponseSource(quotes),
        apiKeyFound: Boolean(ALPHA_VANTAGE_API_KEY),
        quotes
      });
    }

    if (url.pathname === "/api/history") {
      const symbol = normalizeSymbol(url.searchParams.get("symbol") || "AAPL");
      const range = cleanRange(url.searchParams.get("range") || "3mo");
      const history = await getHistory(symbol, range);
      return sendJson(response, history);
    }

    if (url.pathname === "/api/news") {
      const news = await getNews();
      return sendJson(response, {
        source: ALPHA_VANTAGE_API_KEY ? "alpha-vantage" : "demo",
        apiKeyFound: Boolean(ALPHA_VANTAGE_API_KEY),
        news
      });
    }

    return serveFrontend(url.pathname, response);
  } catch (error) {
    console.error(error);
    return sendJson(response, { error: "Auf dem Server ist etwas schiefgelaufen." }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`MonetaKngdm laeuft auf http://localhost:${PORT}`);
});

async function addWatchlistItem(request, response) {
  const body = await readJsonBody(request);
  const symbol = normalizeSymbol(body.symbol);
  if (!symbol) return sendJson(response, { error: "Bitte gib ein Aktien-Symbol ein, zum Beispiel AAPL." }, 400);

  const store = await readStore();
  const exists = store.watchlist.some((item) => item.symbol === symbol);
  if (!exists) {
    const info = fallbackNames[symbol] || {};
    store.watchlist.push({
      symbol,
      name: cleanText(body.name) || info.name || symbol,
      sector: cleanText(body.sector) || info.sector || "Eigene Watchlist"
    });
    await writeStore(store);
  }

  return sendJson(response, store);
}

async function removeWatchlistItem(request, response) {
  const body = await readJsonBody(request);
  const symbol = normalizeSymbol(body.symbol);
  const store = await readStore();
  store.watchlist = store.watchlist.filter((item) => item.symbol !== symbol);
  await writeStore(store);
  return sendJson(response, store);
}

async function addAlert(request, response) {
  const body = await readJsonBody(request);
  const symbol = normalizeSymbol(body.symbol);
  const target = Number(body.target);
  const direction = body.direction === "below" ? "below" : "above";

  if (!symbol || !Number.isFinite(target) || target <= 0) {
    return sendJson(response, { error: "Bitte gib Symbol und Zielkurs korrekt ein." }, 400);
  }

  const store = await readStore();
  store.alerts.push({
    id: randomUUID(),
    symbol,
    direction,
    target,
    active: true,
    triggered: false
  });
  await writeStore(store);
  return sendJson(response, store);
}

async function updateAlert(request, response) {
  const body = await readJsonBody(request);
  const store = await readStore();
  const alert = store.alerts.find((item) => item.id === body.id);
  if (!alert) return sendJson(response, { error: "Aktienwecker nicht gefunden." }, 404);

  if (typeof body.active === "boolean") alert.active = body.active;
  if (typeof body.triggered === "boolean") alert.triggered = body.triggered;

  await writeStore(store);
  return sendJson(response, store);
}

async function removeAlert(request, response) {
  const body = await readJsonBody(request);
  const store = await readStore();
  store.alerts = store.alerts.filter((item) => item.id !== body.id);
  await writeStore(store);
  return sendJson(response, store);
}

async function getQuote(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.time < QUOTE_CACHE_MS) {
    return { ...cached.quote, cached: true };
  }

  const stooqQuote = await getStooqQuote(symbol);
  if (stooqQuote.available) {
    return cacheQuote(symbol, stooqQuote);
  }

  const yahooQuote = await getYahooQuote(symbol);
  if (yahooQuote.available) {
    return cacheQuote(symbol, yahooQuote);
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return cacheQuote(symbol, demoQuotes[symbol] || yahooQuote || stooqQuote);
  }

  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "GLOBAL_QUOTE");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", ALPHA_VANTAGE_API_KEY);

    const data = await fetchAlphaJson(url);
    const apiMessage = sanitizeAlphaMessage(data.Note || data.Information || data["Error Message"]);
    const globalQuote = data["Global Quote"];

    if (!globalQuote || !globalQuote["05. price"]) {
      return cacheQuote(symbol, unavailableQuote(symbol, `${stooqQuote.message} Alpha Vantage: ${apiMessage || "keine Kursdaten geliefert."}`));
    }

    const price = Number(globalQuote["05. price"]);
    const changePercent = Number(String(globalQuote["10. change percent"]).replace("%", ""));
    const info = fallbackNames[symbol] || {};
    return cacheQuote(symbol, quote(
      symbol,
      info.name || symbol,
      price,
      changePercent,
      info.currency || guessCurrency(symbol),
      info.sector || "Aktie",
      formatVolume(globalQuote["06. volume"]),
      "alpha-vantage"
    ));
  } catch (error) {
    return cacheQuote(symbol, unavailableQuote(symbol, `${stooqQuote.message} Alpha Vantage konnte gerade nicht erreicht werden.`));
  }
}

async function getNews() {
  if (!ALPHA_VANTAGE_API_KEY) {
    return demoNews;
  }

  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", "AAPL,MSFT,NVDA,TSLA");
  url.searchParams.set("limit", "3");
  url.searchParams.set("apikey", ALPHA_VANTAGE_API_KEY);

  try {
    const data = await fetchAlphaJson(url);

    if (!Array.isArray(data.feed)) {
      const message = sanitizeAlphaMessage(data.Note || data.Information || data["Error Message"]);
      return [{ title: "News konnten nicht geladen werden", summary: message || "Alpha Vantage hat gerade keine News geliefert.", category: "API", time: "Jetzt" }];
    }

    return data.feed.slice(0, 3).map((item) => ({
      title: item.title,
      summary: item.summary || "Keine Kurzbeschreibung vorhanden.",
      category: item.category_within_source || item.source || "News",
      time: item.time_published ? formatAlphaTime(item.time_published) : "Aktuell"
    }));
  } catch (error) {
    return [{ title: "News konnten nicht geladen werden", summary: "Alpha Vantage konnte gerade nicht erreicht werden.", category: "API", time: "Jetzt" }];
  }
}

async function serveFrontend(pathname, response) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(frontendDir, `.${safePath}`);

  if (!filePath.startsWith(frontendDir) || !existsSync(filePath)) {
    return sendText(response, "Nicht gefunden", 404, "text/plain; charset=utf-8");
  }

  const content = await readFile(filePath);
  const type = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  }[extname(filePath)] || "application/octet-stream";

  response.writeHead(200, { "Content-Type": type });
  response.end(content);
}

async function readStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dataFile)) {
    await writeStore(defaultStore);
    return JSON.parse(JSON.stringify(defaultStore));
  }

  const content = await readFile(dataFile, "utf8");
  const store = JSON.parse(content);
  return normalizeStore({
    watchlist: Array.isArray(store.watchlist) ? store.watchlist : defaultStore.watchlist,
    alerts: Array.isArray(store.alerts) ? store.alerts : defaultStore.alerts
  });
}

async function writeStore(store) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(normalizeStore(store), null, 2));
}

function normalizeStore(store) {
  const watchlistBySymbol = new Map();
  for (const item of store.watchlist || []) {
    const symbol = normalizeSymbol(item.symbol);
    if (!symbol) continue;
    const info = fallbackNames[symbol] || {};
    watchlistBySymbol.set(symbol, {
      symbol,
      name: cleanText(item.name) || info.name || symbol,
      sector: cleanText(item.sector) || info.sector || "Eigene Watchlist"
    });
  }

  return {
    watchlist: [...watchlistBySymbol.values()],
    alerts: (store.alerts || []).map((item) => ({
      ...item,
      symbol: normalizeSymbol(item.symbol)
    })).filter((item) => item.symbol)
  };
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

function quote(symbol, name, price, changePercent, currency, sector, volume, source) {
  return { symbol, name, price, changePercent, currency, sector, volume, source, available: true };
}

function cacheQuote(symbol, quoteData) {
  quoteCache.set(symbol, { quote: quoteData, time: Date.now() });
  return quoteData;
}

function cacheHistory(cacheKey, historyData) {
  historyCache.set(cacheKey, { history: historyData, time: Date.now() });
  return historyData;
}

function unavailableHistory(symbol, message) {
  const info = fallbackNames[symbol] || {};
  return {
    symbol,
    name: info.name || symbol,
    currency: info.currency || guessCurrency(symbol),
    source: "unavailable",
    available: false,
    message,
    points: []
  };
}

async function fetchYahooChart(symbol, range, interval) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  return response.json();
}

async function getStooqQuote(symbol) {
  const candidates = getStooqCandidates(symbol);

  for (const candidate of candidates) {
    try {
      const url = new URL("https://stooq.com/q/l/");
      url.searchParams.set("s", candidate);
      url.searchParams.set("f", "sd2t2ohlcvn");
      url.searchParams.set("h", "");
      url.searchParams.set("e", "csv");

      const response = await fetch(url);
      const csv = await response.text();
      const row = parseStooqCsv(csv);
      if (!row) continue;

      const open = Number(row.Open);
      const close = Number(row.Close);
      const volume = Number(row.Volume);
      if (!Number.isFinite(open) || !Number.isFinite(close) || close <= 0) continue;

      const info = fallbackNames[symbol] || {};
      const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;
      return quote(
        symbol,
        info.name || formatName(row.Name) || symbol,
        close,
        changePercent,
        info.currency || guessCurrencyFromStooq(row.Symbol),
        info.sector || "Aktie",
        formatVolume(volume),
        "stooq"
      );
    } catch (error) {
      // Der naechste Kandidat wird probiert.
    }
  }

  return unavailableQuote(symbol, "Stooq hat fuer dieses Symbol keine Kursdaten geliefert.");
}

async function getYahooQuote(symbol) {
  try {
    const yahooSymbol = getYahooSymbol(symbol);
    const data = await fetchYahooChart(yahooSymbol, "5d", "1d");
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const lastClose = lastNumber(closes);
    const previousClose = Number(meta?.previousClose || meta?.chartPreviousClose);

    if (!Number.isFinite(lastClose) || lastClose <= 0) {
      return unavailableQuote(symbol, "Yahoo Finance hat fuer dieses Symbol keine Kursdaten geliefert.");
    }

    const info = fallbackNames[symbol] || {};
    const changePercent = Number.isFinite(previousClose) && previousClose > 0
      ? ((lastClose - previousClose) / previousClose) * 100
      : 0;

    return quote(
      symbol,
      info.name || meta?.shortName || meta?.longName || symbol,
      lastClose,
      changePercent,
      info.currency || yahooCurrency(meta?.currency),
      info.sector || "Aktie",
      "-",
      "yahoo"
    );
  } catch (error) {
    return unavailableQuote(symbol, "Yahoo Finance konnte gerade nicht erreicht werden.");
  }
}

async function getHistory(symbol, range) {
  const cacheKey = `${symbol}:${range}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.time < HISTORY_CACHE_MS) {
    return { ...cached.history, cached: true };
  }

  try {
    const yahooSymbol = getYahooSymbol(symbol);
    const data = await fetchYahooChart(yahooSymbol, range, "1d");
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const points = timestamps
      .map((timestamp, index) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close: Number(closes[index])
      }))
      .filter((point) => Number.isFinite(point.close) && point.close > 0);

    if (points.length < 2) {
      return cacheHistory(cacheKey, unavailableHistory(symbol, "Fuer dieses Symbol gibt es noch zu wenig Chart-Daten."));
    }

    const info = fallbackNames[symbol] || {};
    return cacheHistory(cacheKey, {
      symbol,
      name: info.name || result?.meta?.shortName || symbol,
      currency: info.currency || yahooCurrency(result?.meta?.currency),
      source: "yahoo",
      available: true,
      points
    });
  } catch (error) {
    return cacheHistory(cacheKey, unavailableHistory(symbol, "Chart-Daten konnten gerade nicht geladen werden."));
  }
}

function getStooqCandidates(symbol) {
  const info = fallbackNames[symbol] || {};
  if (info.stooq) return [info.stooq];

  const cleanSymbol = symbol.toLowerCase();
  if (cleanSymbol.endsWith(".dex")) return [cleanSymbol.replace(".dex", ".de")];
  if (cleanSymbol.includes(".")) return [cleanSymbol];

  return [`${cleanSymbol}.us`, `${cleanSymbol}.de`, cleanSymbol];
}

function getYahooSymbol(symbol) {
  const info = fallbackNames[symbol] || {};
  if (info.yahoo) return info.yahoo;

  if (symbol.endsWith(".DEX")) return `${symbol.replace(".DEX", "")}.DE`;
  if (symbol.endsWith(".DE")) return symbol;
  return symbol;
}

function parseStooqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = lines[0].split(",");
  const values = parseCsvLine(lines[1]);
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  if (!row.Symbol || row.Close === "N/D") return null;
  return row;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function lastNumber(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const number = Number(values[index]);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}

async function fetchAlphaJson(url) {
  const waitTime = Math.max(0, ALPHA_DELAY_MS - (Date.now() - lastAlphaRequestAt));
  if (waitTime > 0) await delay(waitTime);
  lastAlphaRequestAt = Date.now();
  const response = await fetch(url);
  return response.json();
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function unavailableQuote(symbol, message) {
  const info = fallbackNames[symbol] || {};
  return {
    symbol,
    name: info.name || symbol,
    price: null,
    changePercent: null,
    currency: info.currency || guessCurrency(symbol),
    sector: info.sector || "Aktie",
    volume: "-",
    source: "unavailable",
    available: false,
    message
  };
}

function sanitizeAlphaMessage(message) {
  const text = String(message || "");
  if (!text) return "";
  if (text.toLowerCase().includes("25 requests per day")) return "Alpha Vantage Tageslimit erreicht.";
  if (text.toLowerCase().includes("rate limit") || text.toLowerCase().includes("frequency")) return "Alpha Vantage Limit erreicht. Bitte spaeter erneut probieren.";
  if (text.toLowerCase().includes("invalid api call")) return "Alpha Vantage kennt dieses Symbol nicht.";
  if (text.toLowerCase().includes("api key")) return "Alpha Vantage meldet ein API-Key-Problem.";
  return ALPHA_VANTAGE_API_KEY ? text.replace(ALPHA_VANTAGE_API_KEY, "[geschuetzt]") : text;
}

function parseSymbols(value) {
  return uniqueSymbols(value.split(",").map(normalizeSymbol).filter(Boolean));
}

function uniqueSymbols(symbols) {
  return [...new Set(symbols)];
}

function normalizeSymbol(value) {
  const cleanSymbol = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  return symbolAliases[cleanSymbol] || cleanSymbol;
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 60);
}

function cleanRange(value) {
  const range = String(value || "").trim();
  return ["1mo", "3mo", "6mo", "1y"].includes(range) ? range : "3mo";
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function sendText(response, text, status, contentType) {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(text);
}

function formatVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1).replace(".", ",")} Mio.`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1).replace(".", ",")} Tsd.`;
  return String(number);
}

function getQuoteResponseSource(quotes) {
  if (quotes.some((item) => item.source === "alpha-vantage")) return "alpha-vantage";
  if (quotes.some((item) => item.source === "yahoo")) return "yahoo";
  if (quotes.some((item) => item.source === "stooq")) return "stooq";
  if (quotes.some((item) => item.source === "demo")) return "demo";
  return "unavailable";
}

function formatAlphaTime(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(value);
  if (!match) return "Aktuell";
  return `${match[3]}.${match[2]}.${match[1]} ${match[4]}:${match[5]}`;
}

function guessCurrency(symbol) {
  return symbol.endsWith(".DE") || symbol.endsWith(".DEX") ? "EUR" : "$";
}

function guessCurrencyFromStooq(symbol) {
  return String(symbol || "").toUpperCase().endsWith(".DE") ? "EUR" : "$";
}

function yahooCurrency(currency) {
  return currency === "EUR" ? "EUR" : currency === "CAD" ? "CAD" : "$";
}

function formatName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith("#") || !cleanLine.includes("=")) continue;
    const [key, ...valueParts] = cleanLine.split("=");
    if (!process.env[key]) process.env[key] = valueParts.join("=").trim();
  }
}
