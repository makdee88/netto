export type BrokerType = 'AVANZA' | 'ZERODHA' | 'IBKR';
export type AssetCategory = 'EQUITY' | 'FIXED_DEPOSIT';
export type CurrencyCode = 'SEK' | 'INR' | 'USD' | 'EUR';

export interface HoldingRow {
  id: number;
  broker: string;
  category: AssetCategory;
  symbol: string;
  name: string;
  currency: CurrencyCode;
  quantity: number;
  avg_price: number;
  market_price: number;
  principal: number;
  interest_rate: number;
  compounding_freq: number;
  start_date: string;
  maturity_date: string;
  updated_at: string;
}

// Ambient module declaration for sql.js to fix TS7016
declare module 'sql.js';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}