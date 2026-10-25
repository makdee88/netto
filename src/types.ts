export type BrokerType = 'AVANZA' | 'NORDNET' | 'ZERODHA' | 'UPSTOX' | 'IBKR';
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

declare module 'sql.js' {
  export interface Statement {
    step(): boolean;
    getAsObject(): Record<string, any>;
    free(): boolean;
  }
  export interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): Array<{ columns: string[]; values: any[][] }>;
    prepare(sql: string, params?: any[]): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}

declare module '*.wasm?url' {
  const src: string;
  export default src;
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