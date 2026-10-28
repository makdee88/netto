// src/utils/sectorPresets.ts
import { GicsSector, SectorWeight, HoldingRow } from '../types';

export const BENCHMARK_PROFILES: Record<string, SectorWeight[]> = {
  GLOBAL_WORLD: [
    { sector: 'Technology', weight_pct: 26.5 },
    { sector: 'Financials', weight_pct: 15.5 },
    { sector: 'Healthcare', weight_pct: 12.0 },
    { sector: 'Industrials', weight_pct: 11.0 },
    { sector: 'Consumer Discretionary', weight_pct: 10.5 },
    { sector: 'Communication Services', weight_pct: 8.5 },
    { sector: 'Consumer Staples', weight_pct: 6.5 },
    { sector: 'Energy', weight_pct: 4.0 },
    { sector: 'Materials', weight_pct: 3.0 },
    { sector: 'Utilities', weight_pct: 2.5 },
  ],
  GLOBAL_VALUE: [
    { sector: 'Financials', weight_pct: 28.0 },
    { sector: 'Industrials', weight_pct: 15.0 },
    { sector: 'Healthcare', weight_pct: 14.0 },
    { sector: 'Technology', weight_pct: 10.5 },
    { sector: 'Consumer Staples', weight_pct: 9.0 },
    { sector: 'Energy', weight_pct: 8.5 },
    { sector: 'Communication Services', weight_pct: 6.0 },
    { sector: 'Utilities', weight_pct: 5.0 },
    { sector: 'Materials', weight_pct: 4.0 },
  ],
  SP500_USA: [
    { sector: 'Technology', weight_pct: 31.5 },
    { sector: 'Financials', weight_pct: 13.0 },
    { sector: 'Healthcare', weight_pct: 12.0 },
    { sector: 'Consumer Discretionary', weight_pct: 10.5 },
    { sector: 'Communication Services', weight_pct: 9.0 },
    { sector: 'Industrials', weight_pct: 8.5 },
    { sector: 'Consumer Staples', weight_pct: 6.0 },
    { sector: 'Energy', weight_pct: 3.8 },
    { sector: 'Utilities', weight_pct: 2.9 },
    { sector: 'Materials', weight_pct: 2.8 },
  ],
  SWEDEN_INDEX: [
    { sector: 'Industrials', weight_pct: 39.5 },
    { sector: 'Financials', weight_pct: 26.5 },
    { sector: 'Technology', weight_pct: 9.5 },
    { sector: 'Healthcare', weight_pct: 8.0 },
    { sector: 'Consumer Discretionary', weight_pct: 7.5 },
    { sector: 'Materials', weight_pct: 5.0 },
    { sector: 'Communication Services', weight_pct: 4.0 },
  ],
  SWEDEN_INVESTMENTBOLAG: [
    { sector: 'Financials', weight_pct: 55.0 },
    { sector: 'Industrials', weight_pct: 32.0 },
    { sector: 'Healthcare', weight_pct: 7.0 },
    { sector: 'Technology', weight_pct: 6.0 },
  ],
  INDIA_BROAD: [
    { sector: 'Financials', weight_pct: 33.5 },
    { sector: 'Technology', weight_pct: 14.0 },
    { sector: 'Energy', weight_pct: 11.5 },
    { sector: 'Consumer Discretionary', weight_pct: 9.5 },
    { sector: 'Consumer Staples', weight_pct: 8.5 },
    { sector: 'Industrials', weight_pct: 7.5 },
    { sector: 'Materials', weight_pct: 6.5 },
    { sector: 'Healthcare', weight_pct: 5.0 },
    { sector: 'Utilities', weight_pct: 4.0 },
  ],
  EMERGING_MARKETS: [
    { sector: 'Technology', weight_pct: 24.0 },
    { sector: 'Financials', weight_pct: 22.0 },
    { sector: 'Consumer Discretionary', weight_pct: 13.0 },
    { sector: 'Communication Services', weight_pct: 9.5 },
    { sector: 'Materials', weight_pct: 7.5 },
    { sector: 'Industrials', weight_pct: 7.0 },
    { sector: 'Energy', weight_pct: 5.5 },
    { sector: 'Consumer Staples', weight_pct: 5.5 },
    { sector: 'Healthcare', weight_pct: 3.5 },
    { sector: 'Utilities', weight_pct: 2.5 },
  ],
};

export const matchHoldingToSectorWeights = (
  name: string,
  symbol: string,
  category?: string
): SectorWeight[] => {
  const target = `${name || ''} ${symbol || ''}`.toLowerCase().replace(/[-_.,]/g, ' ');
  const single = (sector: GicsSector): SectorWeight[] => [{ sector, weight_pct: 100 }];

  // 1. Value Factor ETFs / Funds (e.g. IWVL / MSCI World Value)
  if (target.includes('iwvl') || (target.includes('world') && target.includes('value'))) {
    return BENCHMARK_PROFILES.GLOBAL_VALUE;
  }

  // 2. Swedish Investmentbolag (Spiltan, Investor, Industrivärden)
  if (target.includes('spiltan') || target.includes('investmentbolag')) {
    return BENCHMARK_PROFILES.SWEDEN_INVESTMENTBOLAG;
  }

  // 3. Emerging Markets / Tillväxtmarknad
  if (target.match(/emerging|tillväxt|em imi|asiat|asia/)) {
    return BENCHMARK_PROFILES.EMERGING_MARKETS;
  }

  // 4. Sweden / Nordic Index Funds
  if (target.match(/omx|sverige|sweden|avanza zero|plus alla bolag|norden|nordic|sverigefond/)) {
    return BENCHMARK_PROFILES.SWEDEN_INDEX;
  }

  // 5. US / S&P 500 / Nasdaq
  if (target.match(/usa|s&p|sp500|nasdaq|north america|nordamerika|qqq|spy|vusa/)) {
    return BENCHMARK_PROFILES.SP500_USA;
  }

  // 6. India Mutual Funds & ETFs (Nifty, Sensex, Flexicap, Parag Parikh, Kuvera/Zerodha funds)
  if (
    target.match(
      /nifty|sensex|india|bharat|parag parikh|mirae|axis|kotak|sbi|hdfc|icici|nippon|uti|quant|motilal|canara|tata|bandhan|elss|flexi|midcap|smallcap|largecap/
    )
  ) {
    // Check if it's specifically an Indian single stock first
    if (category === 'EQUITY' && !target.match(/fund|etf|index|nifty|sensex|bees|plan|growth|direct/)) {
      if (target.match(/hdfc|icici|kotak|sbi|axis|bajaj/)) return single('Financials');
      if (target.match(/tcs|infosys|infy|wipro|hcl|techm/)) return single('Technology');
      if (target.match(/tata motors|maruti|mahindra|titan/)) return single('Consumer Discretionary');
      if (target.match(/itc|hul|hindustan unilever|nestle/)) return single('Consumer Staples');
      if (target.match(/reliance|ongc|ntpc|power/)) return single('Energy');
    }
    return BENCHMARK_PROFILES.INDIA_BROAD;
  }

  // 7. Global / World Index Funds
  if (target.match(/global|world|msci|acwi|länsförsäkringar|storebrand|dnb|lys|vanguard|ishares|amundi|xtrackers/)) {
    return BENCHMARK_PROFILES.GLOBAL_WORLD;
  }

  // 8. Individual Stocks Keyword Classification
  if (target.match(/tech|semiconductor|software|apple|aapl|microsoft|msft|nvidia|nvda|alphabet|goog|meta|ericsson|hexatronic|sinch|fortnox/)) {
    return single('Technology');
  }
  if (target.match(/bank|financial|investor|inve|industrivärden|latour|kinnevik|lundberg|seb|swedbank|handelsbanken|shb|nordea|avanza/)) {
    return single('Financials');
  }
  if (target.match(/health|pharma|astrazeneca|azn|novo|sobi|getinge|elekta|camurus|vitrolife|sun pharma|cipla/)) {
    return single('Healthcare');
  }
  if (target.match(/industrial|volvo|atlas copco|atco|sandvik|abb|assa abloy|alfa laval|skf|epiroc|hexagon|nibe|saab|scania|skanska|peab/)) {
    return single('Industrials');
  }
  if (target.match(/hm|h&m|hennes|evolution|evo|electrolux|thule|dometic|boozt|embark|paradox/)) {
    return single('Consumer Discretionary');
  }
  if (target.match(/axfood|essity|aaK|cloetta|oriflame/)) {
    return single('Consumer Staples');
  }
  if (target.match(/tele2|telia|millicom|viaplay|spotify/)) {
    return single('Communication Services');
  }
  if (target.match(/boliden|ssab|holmen|sca|stora enso|billerud|lundin/)) {
    return single('Materials');
  }
  if (target.match(/castellum|balder|sagax|fabege|wallenstam|hufvudstaden|wihlborgs|nyfosa|catena|fastighet|real estate/)) {
    return single('Real Estate');
  }
  if (target.match(/energy|oil|gas|equinor|orrön|ipco|tullow|vestas|orsted/)) {
    return single('Energy');
  }

  // 9. Any remaining Mutual Fund / ETF defaults to Global World look-through
  if (category === 'MUTUAL_FUND' || target.match(/fond|fund|etf|ucits|index|acc|dist/)) {
    return BENCHMARK_PROFILES.GLOBAL_WORLD;
  }

  return [{ sector: 'Other / Unclassified', weight_pct: 100 }];
};

/**
 * Fetches live sector breakdowns from /api/sectors with automatic local look-through fallback
 */
export const fetchAndClassifyHoldings = async (
  holdings: HoldingRow[],
  onlyUnclassified = false,
  existingMap: Record<string, SectorWeight[]> = {}
): Promise<Record<string, SectorWeight[]>> => {
  const eligible = holdings.filter(
    (h) => h.category === 'EQUITY' || h.category === 'MUTUAL_FUND'
  );

  const targets = onlyUnclassified
    ? eligible.filter((h) => {
        const cur = existingMap[h.symbol];
        return (
          !cur ||
          cur.length === 0 ||
          (cur.length === 1 && cur[0].sector === 'Other / Unclassified')
        );
      })
    : eligible;

  if (targets.length === 0) return {};

  const finalMap: Record<string, SectorWeight[]> = {};

  // 1. Try live Yahoo Finance lookup via /api/sectors
  try {
    const res = await fetch('/api/sectors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holdings: targets.map((h) => ({
          symbol: h.symbol,
          name: h.name,
          category: h.category,
        })),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.sectors) {
        Object.assign(finalMap, data.sectors);
      }
    }
  } catch {
    // Offline or local dev server without /api/sectors — continue to local look-through
  }

  // 2. For any holding not resolved by the API, apply smart look-through rules
  for (const h of targets) {
    if (!finalMap[h.symbol] || finalMap[h.symbol].length === 0) {
      finalMap[h.symbol] = matchHoldingToSectorWeights(h.name, h.symbol, h.category);
    }
  }

  return finalMap;
};