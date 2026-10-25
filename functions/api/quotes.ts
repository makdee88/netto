export interface Env {
  USAGE_ANALYTICS?: {
    writeDataPoint: (event: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => void;
  };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const symbolsParam = url.searchParams.get('symbols') || '';
  const symbols = symbolsParam.split(',').filter(Boolean);

  const vaultId = request.headers.get('X-Vault-Id') || 'anonymous';
  const baseCurrency = request.headers.get('X-Base-Currency') || 'SEK';
  const country = (request.cf?.country as string) || 'UNKNOWN';

  if (env.USAGE_ANALYTICS) {
    env.USAGE_ANALYTICS.writeDataPoint({
      indexes: [vaultId],
      blobs: ['PRICE_SYNC', country, baseCurrency],
      doubles: [symbols.length],
    });
  }

  const quotes: Record<string, number> = {};
  const fxPairs = ['USDSEK=X', 'EURSEK=X', 'INRSEK=X'];
  const allTickers = [...new Set([...symbols, ...fxPairs])];

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
