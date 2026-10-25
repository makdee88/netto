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

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}