async function fetchAvanzaPriceByIsinOrName(query: string): Promise<number | null> {
  try {
    const res = await fetch('https://www.avanza.se/_cqbe/search/global-search/global-search-template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({
        query: query.trim(),
        searchFilter: { types: ['FUND', 'STOCK', 'EXCHANGE_TRADED_FUND', 'CERTIFICATE'] },
        screenSize: 'DESKTOP',
        originPath: '/start',
        pagination: { from: 0, size: 5 },
      }),
    });

    if (!res.ok) return null;
    const data: any = await res.json();
    const hit = data?.resultGroups?.[0]?.hits?.[0];
    if (!hit) return null;

    // Avanza returns price strings like "269,04" or "502,05" inside hit.price.last
    const rawPriceStr =
      hit?.price?.last ||
      hit?.lastPrice ||
      hit?.rate ||
      '';

    if (typeof rawPriceStr === 'number') return rawPriceStr;
    if (typeof rawPriceStr === 'string' && rawPriceStr.trim() !== '') {
      const cleaned = rawPriceStr.replace(/\s/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // Fall through to Yahoo fallback
  }
  return null;
}

async function fetchYahooChartPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === 'number' && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function resolveIsinViaYahoo(isin: string): Promise<number | null> {
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!searchRes.ok) return null;
    const searchData: any = await searchRes.json();
    const resolvedTicker = searchData?.quotes?.[0]?.symbol;
    if (resolvedTicker) {
      return await fetchYahooChartPrice(resolvedTicker);
    }
  } catch {
    return null;
  }
  return null;
}

export const onRequestGet = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const inputSymbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);

  const quotes: Record<string, number> = {};

  // 1. Fetch Live Asset Quotes in parallel
  await Promise.all(
    inputSymbols.map(async (sym) => {
      const isIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(sym);

      // Try Avanza public search first for ISINs (especially SE... funds)
      if (isIsin) {
        const avanzaPrice = await fetchAvanzaPriceByIsinOrName(sym);
        if (avanzaPrice !== null) {
          quotes[sym] = avanzaPrice;
          return;
        }
        const yahooIsinPrice = await resolveIsinViaYahoo(sym);
        if (yahooIsinPrice !== null) {
          quotes[sym] = yahooIsinPrice;
          return;
        }
      } else {
        // Standard stock ticker (e.g. AAPL, RELIANCE.NS, INVE-B.ST)
        const directPrice = await fetchYahooChartPrice(sym);
        if (directPrice !== null) {
          quotes[sym] = directPrice;
          return;
        }
        // Fallback to Avanza search if it's a Swedish shortname
        const avanzaFallback = await fetchAvanzaPriceByIsinOrName(sym);
        if (avanzaFallback !== null) {
          quotes[sym] = avanzaFallback;
        }
      }
    })
  );

  // 2. Fetch Live FX Rates via Yahoo v8 Chart endpoint
  const [usdSek, eurSek, inrSek] = await Promise.all([
    fetchYahooChartPrice('USDSEK=X'),
    fetchYahooChartPrice('EURSEK=X'),
    fetchYahooChartPrice('INRSEK=X'),
  ]);

  return new Response(
    JSON.stringify({
      quotes,
      fxRates: {
        SEK: 1,
        USD: usdSek || 10.45,
        EUR: eurSek || 11.35,
        INR: inrSek || 0.125,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};