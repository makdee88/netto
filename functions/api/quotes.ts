export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const inputSymbols = symbolsParam.split(',').filter(Boolean);

  const quotes: Record<string, number> = {};
  const resolvedTickers: string[] = [];

  // Step 1: Resolve any ISIN or raw symbol to a valid Yahoo Finance ticker
  for (const sym of inputSymbols) {
    const cleanSym = sym.trim();
    if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(cleanSym)) {
      // It's an ISIN, query Yahoo Search to find the ticker symbol
      try {
        const searchRes = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanSym)}&quotesCount=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (searchRes.ok) {
          const searchData: any = await searchRes.json();
          const match = searchData?.quotes?.[0]?.symbol;
          if (match) {
            resolvedTickers.push(match);
            continue;
          }
        }
      } catch (e) {
        // Fallback if search fails
      }
    }
    resolvedTickers.push(cleanSym);
  }

  const fxPairs = ['USDSEK=X', 'EURSEK=X', 'INRSEK=X'];
  const allTickers = [...new Set([...resolvedTickers, ...fxPairs])];

  // Step 2: Fetch prices for resolved tickers
  if (allTickers.length > 0) {
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      allTickers.join(',')
    )}`;
    const response = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (response.ok) {
      const json: any = await response.json();
      for (const item of json?.quoteResponse?.result || []) {
        quotes[item.symbol] = item.regularMarketPrice;
        
        // Map back so the frontend receives prices keyed by the original requested symbol/ISIN if needed
        for (const originalInput of inputSymbols) {
          if (item.symbol.includes(originalInput) || originalInput === item.symbol) {
            quotes[originalInput] = item.regularMarketPrice;
          }
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      quotes,
      fxRates: {
        SEK: 1,
        USD: quotes['USDSEK=X'] || 10.45,
        EUR: quotes['EURSEK=X'] || 11.35,
        INR: quotes['INRSEK=X'] || 0.125,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
};