// functions/api/sectors.ts

const YAHOO_SECTOR_MAP: Record<string, string> = {
  technology: 'Technology',
  financial_services: 'Financials',
  financial: 'Financials',
  healthcare: 'Healthcare',
  consumer_cyclical: 'Consumer Discretionary',
  consumer_defensive: 'Consumer Staples',
  industrials: 'Industrials',
  energy: 'Energy',
  utilities: 'Utilities',
  basic_materials: 'Materials',
  real_estate: 'Real Estate',
  communication_services: 'Communication Services',
};

interface HoldingQuery {
  symbol: string;
  name: string;
  category: string;
}

interface SectorWeight {
  sector: string;
  weight_pct: number;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

async function resolveYahooTicker(symbol: string, name: string): Promise<string | null> {
  const cleanSym = (symbol || '').trim();
  if (/^[A-Z0-9.-]{1,12}$/i.test(cleanSym) && !cleanSym.includes('_')) {
    return cleanSym;
  }

  const searchTerms = [name, symbol].filter(Boolean).join(' ');
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      searchTerms
    )}&quotesCount=3&newsCount=0`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data: any = await res.json();
    const firstQuote = data?.quotes?.[0];
    return firstQuote?.symbol || null;
  } catch {
    return null;
  }
}

async function fetchYahooSectorBreakdown(ticker: string): Promise<SectorWeight[] | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker
    )}?modules=assetProfile,topHoldings,quoteType`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;

    const json: any = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    // 1. Check ETF / Mutual Fund multi-sector weightings
    const sectorWeightings = result?.topHoldings?.sectorWeightings;
    if (Array.isArray(sectorWeightings) && sectorWeightings.length > 0) {
      const weights: SectorWeight[] = [];
      let total = 0;

      for (const entry of sectorWeightings) {
        const [rawSector, rawVal] = Object.entries(entry)[0] || [];
        const pct = Number(rawVal) * 100;
        if (rawSector && pct > 0) {
          const mapped = YAHOO_SECTOR_MAP[rawSector.toLowerCase()] || 'Other / Unclassified';
          weights.push({
            sector: mapped,
            weight_pct: Math.round(pct * 10) / 10,
          });
          total += pct;
        }
      }

      if (weights.length > 0 && total > 0) {
        return weights.map((w) => ({
          sector: w.sector,
          weight_pct: Math.round((w.weight_pct / total) * 1000) / 10,
        }));
      }
    }

    // 2. Check Single Stock GICS Sector
    const stockSector = result?.assetProfile?.sector;
    if (stockSector) {
      const key = stockSector.toLowerCase().replace(/[\s-]+/g, '_');
      const mapped = YAHOO_SECTOR_MAP[key] || stockSector;
      return [{ sector: mapped, weight_pct: 100 }];
    }

    return null;
  } catch {
    return null;
  }
}

// Cloudflare Pages Function handler
export async function onRequestPost(context: { request: Request }): Promise<Response> {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const holdings: HoldingQuery[] = body?.holdings || [];
    const results: Record<string, SectorWeight[]> = {};

    await Promise.all(
      holdings.map(async (h) => {
        const ticker = await resolveYahooTicker(h.symbol, h.name);
        if (ticker) {
          const breakdown = await fetchYahooSectorBreakdown(ticker);
          if (breakdown && breakdown.length > 0) {
            results[h.symbol] = breakdown;
          }
        }
      })
    );

    return new Response(JSON.stringify({ sectors: results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Sector lookup error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

// Compatibility export if invoked directly with (req: Request)
export default async function handler(req: Request): Promise<Response> {
  return onRequestPost({ request: req });
}