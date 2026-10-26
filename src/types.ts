export type BrokerType = 'AVANZA' | 'NORDNET' | 'ZERODHA' | 'UPSTOX' | 'IBKR';
export type AssetCategory = 'EQUITY' | 'FIXED_DEPOSIT';
export type PropertyType = 'APARTMENT' | 'LAND' | 'HOUSE' | 'COMMERCIAL';
export type LiabilityType = 'MORTGAGE' | 'CAR_LOAN' | 'PERSONAL_LOAN' | 'CREDIT_CARD';
export type CurrencyCode = 'SEK' | 'INR' | 'USD' | 'EUR';
export type AuthMode = 'CREATE_OR_UNLOCK' | 'RESTORE_RETURNING';

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

export interface TransactionRow {
  id: number;
  tx_hash: string;
  broker: string;
  account: string;
  tx_date: string;
  tx_type: 'BUY' | 'SELL' | 'SPLIT';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  currency: CurrencyCode;
  created_at: string;
}

export interface CsvImportResult {
  broker: string;
  mode: 'TRANSACTIONS' | 'SNAPSHOT';
  totalRowsRead: number;
  newTransactionsAdded: number;
  duplicateTransactionsSkipped: number;
  holdingsUpdated: number;
}

export interface PropertyRow {
  id: number;
  name: string;
  property_type: PropertyType;
  currency: CurrencyCode;
  buy_price: number;
  buy_month: number;
  buy_year: number;
  current_price: number;
}

export interface LiabilityRow {
  id: number;
  name: string;
  liability_type: LiabilityType;
  currency: CurrencyCode;
  total_loan: number;
  remaining_balance: number;
  interest_rate: number;
}

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