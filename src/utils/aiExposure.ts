import { HoldingRow } from '../types';

export const getHoldingAiExposure = (h: HoldingRow): number => {
  const target = `${h.name || ''} ${h.symbol || ''}`.toLowerCase().replace(/[-_.,]/g, ' ');

  // 1. Broad Index Funds & ETFs
  if (target.includes('nasdaq') || target.includes('qqq')) return 58;
  if (target.includes('usa') || target.includes('s&p') || target.includes('sp500')) return 35;
  if (target.includes('iwvl') || (target.includes('world') && target.includes('value'))) return 9;
  if (target.match(/global|world|msci|acwi|länsförsäkringar|storebrand|dnb/)) return 26;
  if (target.match(/nifty|sensex|india/)) return 14;
  if (target.match(/omx|sverige|sweden|avanza zero|spiltan/)) return 6;

  // 2. Direct Mega-Cap Hyperscalers & AI Hardware (Core Enablers)
  if (target.match(/nvidia|nvda|taiwan semi|tsmc|tsm|broadcom|avgo|asml|amd|arm |palantir|pltr/)) return 100;
  if (target.match(/microsoft|msft|alphabet|google|goog|meta platforms|meta/)) return 90;
  if (target.match(/amazon|amzn|apple|aapl/)) return 70;

  // 3. Enterprise Software & IT Services (Adopters & Integrators)
  if (target.match(/oracle|orcl|sap|salesforce|crm|adobe|adbe|servicenow|snow/)) return 50;
  if (target.match(/tcs|infosys|infy|wipro|hcl/)) return 40;

  return 0;
};