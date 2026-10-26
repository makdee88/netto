// ==========================================
// Netto Core Types & Interfaces
// ==========================================

export type CurrencyCode = 'SEK' | 'INR' | 'USD' | 'EUR';

export type AuthMode = 'CREATE_OR_UNLOCK' | 'RESTORE_RETURNING';

export type AssetCategory = 'EQUITY' | 'FIXED_DEPOSIT';

export type PropertyType = 'Apartment' | 'House / Villa' | 'Plot / Land' | 'Commercial' | string;

export type LiabilityType = 'Mortgage' | 'Vehicle Loan' | 'Personal Loan' | 'Credit / Other' | string;

export type CompoundingFrequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'MONTHLY' | string;

// --- Holdings & Portfolios ---

export interface HoldingRow {
  id: number;
  broker: string;
  category: AssetCategory;
  symbol: string;
  name: string;
  isin?: string;
  currency: CurrencyCode;
  quantity: number;
  avg_price: number;
  market_price: number;
  principal?: number;
  interest_rate?: number;
  compounding_freq?: CompoundingFrequency;
  start_date?: string;
  maturity_date?: string;
  created_at?: string;
  updated_at?: string;
}

// --- Transactions Ledger ---

export interface TransactionRow {
  id: number;
  broker: string;
  category: AssetCategory;
  symbol: string;
  name: string;
  isin?: string;
  currency: CurrencyCode;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  trade_date: string;
  created_at?: string;
}

// --- Real Estate / Properties ---

export interface PropertyRow {
  id: number;
  name: string;
  property_type: PropertyType;
  currency: CurrencyCode;
  buy_price: number;
  buy_month: number;
  buy_year: number;
  current_price: number;
  created_at?: string;
  updated_at?: string;
}

// --- Liabilities & Debt ---

export interface LiabilityRow {
  id: number;
  name: string;
  liability_type: LiabilityType;
  currency: CurrencyCode;
  total_loan: number;
  remaining_balance: number;
  interest_rate: number;
  created_at?: string;
  updated_at?: string;
}

// --- Net Worth Snapshots ---

export interface SnapshotRow {
  id: number;
  timestamp: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
}

// --- Import & Ingestion Results ---

export interface CsvImportResult {
  broker: string;
  newTransactionsAdded: number;
  holdingsUpdated: number;
  duplicatesSkipped?: number;
  errors?: string[];
}

// --- Market Quotes & Exchange Rates ---

export interface LiveMarketData {
  quotes: Record<string, number>;
  fxRates: Record<string, number>;
  updatedAt: string;
}

// --- Vault Metadata & Settings ---

export interface VaultMetadata {
  vaultName: string;
  createdAt: string;
  lastSyncedAt?: string;
  storageKey: string;
}

// --- Global Window Types (GIS / Google Identity Services) ---

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
              expires_in?: number;
            }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}