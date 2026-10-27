import { GicsSector, SectorWeight } from '../types';

export const BENCHMARK_PROFILES: Record<string, SectorWeight[]> = {
  GLOBAL_WORLD: [
    { sector: 'Technology', weight_pct: 26.5 },
    { sector: 'Financials', weight_pct: 15.5 },
    { sector: 'Healthcare', weight_pct: 12.0 },
    { sector: 'Consumer Discretionary', weight_pct: 10.5 },
    { sector: 'Industrials', weight_pct: 11.0 },
    { sector: 'Communication Services', weight_pct: 8.5 },
    { sector: 'Consumer Staples', weight_pct: 6.5 },
    { sector: 'Energy', weight_pct: 4.0 },
    { sector: 'Materials', weight_pct: 3.0 },
    { sector: 'Utilities', weight_pct: 2.5 },
  ],
  SP500_USA: [
    { sector: 'Technology', weight_pct: 31.0 },
    { sector: 'Financials', weight_pct: 13.0 },
    { sector: 'Healthcare', weight_pct: 12.0 },
    { sector: 'Consumer Discretionary', weight_pct: 10.5 },
    { sector: 'Communication Services', weight_pct: 9.0 },
    { sector: 'Industrials', weight_pct: 8.5 },
    { sector: 'Consumer Staples', weight_pct: 6.0 },
    { sector: 'Energy', weight_pct: 4.0 },
    { sector: 'Utilities', weight_pct: 3.0 },
    { sector: 'Materials', weight_pct: 3.0 },
  ],
  SWEDEN_OMXS30: [
    { sector: 'Industrials', weight_pct: 38.0 },
    { sector: 'Financials', weight_pct: 26.0 },
    { sector: 'Technology', weight_pct: 10.0 },
    { sector: 'Healthcare', weight_pct: 9.0 },
    { sector: 'Consumer Discretionary', weight_pct: 8.0 },
    { sector: 'Materials', weight_pct: 5.0 },
    { sector: 'Communication Services', weight_pct: 4.0 },
  ],
  INDIA_NIFTY50: [
    { sector: 'Financials', weight_pct: 34.0 },
    { sector: 'Technology', weight_pct: 13.5 },
    { sector: 'Energy', weight_pct: 11.5 },
    { sector: 'Consumer Staples', weight_pct: 9.0 },
    { sector: 'Consumer Discretionary', weight_pct: 8.5 },
    { sector: 'Materials', weight_pct: 8.0 },
    { sector: 'Industrials', weight_pct: 6.5 },
    { sector: 'Healthcare', weight_pct: 4.5 },
    { sector: 'Utilities', weight_pct: 2.5 },
    { sector: 'Communication Services', weight_pct: 2.0 },
  ],
};

export const matchHoldingToSectorWeights = (name: string, symbol: string): SectorWeight[] => {
  const target = `${name} ${symbol}`.toLowerCase();

  // 1. Broad Index Funds & ETFs
  if (
    target.includes('global') ||
    target.includes('msci world') ||
    target.includes('länsförsäkringar global') ||
    target.includes('iwvl') ||
    target.includes('avanza global')
  ) {
    return BENCHMARK_PROFILES.GLOBAL_WORLD;
  }
  if (
    target.includes('usa') ||
    target.includes('s&p') ||
    target.includes('sp500') ||
    target.includes('nasdaq')
  ) {
    return BENCHMARK_PROFILES.SP500_USA;
  }
  if (
    target.includes('omx') ||
    target.includes('sverige') ||
    target.includes('sweden') ||
    target.includes('avanza zero')
  ) {
    return BENCHMARK_PROFILES.SWEDEN_OMXS30;
  }
  if (
    target.includes('nifty') ||
    target.includes('bharat') ||
    target.includes('india') ||
    target.includes('sensex')
  ) {
    return BENCHMARK_PROFILES.INDIA_NIFTY50;
  }

  // 2. Keyword Single-Stock Detection (100% allocation)
  const single = (sector: GicsSector): SectorWeight[] => [{ sector, weight_pct: 100 }];

  if (
    target.includes('tech') ||
    target.includes('semiconductor') ||
    target.includes('software') ||
    target.includes('apple') ||
    target.includes('microsoft') ||
    target.includes('nvidia') ||
    target.includes('tcs') ||
    target.includes('infosys')
  ) {
    return single('Technology');
  }
  if (
    target.includes('bank') ||
    target.includes('financial') ||
    target.includes('investor') ||
    target.includes('seb') ||
    target.includes('swedbank') ||
    target.includes('handelsbanken') ||
    target.includes('hdfc') ||
    target.includes('icici')
  ) {
    return single('Financials');
  }
  if (
    target.includes('health') ||
    target.includes('pharma') ||
    target.includes('astrazeneca') ||
    target.includes('sun pharma')
  ) {
    return single('Healthcare');
  }
  if (
    target.includes('industrial') ||
    target.includes('volvo') ||
    target.includes('atlas copco') ||
    target.includes('sandvik') ||
    target.includes('abb') ||
    target.includes('l&t')
  ) {
    return single('Industrials');
  }

  return [{ sector: 'Other / Unclassified', weight_pct: 100 }];
};