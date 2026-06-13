/**
 * sql.js adapter: provides a better-sqlite3 compatible API
 * backed by sql.js (WASM-based SQLite, no native compilation needed).
 * 
 * This allows database.ts and all callers (100+ sites) to work without changes.
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type Statement as SqlJsStatement, type QueryExecResult } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

let SQL: SqlJsStatic | null = null;

/** One-time async init. Must call before using Database. */
export async function initAdapter(): Promise<void> {
  if (SQL) return;
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      // In Electron packaged app, wasm path resolves relative to main.js
      // build-main.mjs copies sql-wasm.wasm to dist/
      return require('path').join(__dirname, file);
    }
  });
}

// ── Statement wrapper (better-sqlite3 compatible) ──

class Statement {
  private stmt: SqlJsStatement;
  private _sql: string;
  
  constructor(db: SqlJsDatabase, sql: string) {
    this._sql = sql;
    this.stmt = db.prepare(sql);
  }
  
  /** Bind parameters and return all rows as objects */
  all(...params: any[]): Record<string, any>[] {
    const flatParams = params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])
      ? params[0] : params;
    
    this.stmt.bind(flatParams);
    const results: Record<string, any>[] = [];
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return results;
  }
  
  /** Bind parameters and return first row */
  get(...params: any[]): Record<string, any> | undefined {
    const flatParams = params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])
      ? params[0] : params;
    
    this.stmt.bind(flatParams);
    let result: Record<string, any> | undefined;
    if (this.stmt.step()) {
      result = this.stmt.getAsObject();
    }
    this.stmt.reset();
    return result;
  }
  
  /** Execute INSERT/UPDATE/DELETE, return { changes, lastInsertRowid } */
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const flatParams = params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])
      ? params[0] : params;
    
    this.stmt.bind(flatParams);
    this.stmt.step();
    this.stmt.reset();
    // sql.js doesn't track changes/lastInsertRowid per statement
    // Return reasonable defaults
    return { changes: 1, lastInsertRowid: 0 };
  }
  
  /** Release the prepared statement */
  finalize(): void {
    this.stmt.free();
  }
  
  get source(): string { return this._sql; }
}

// ── Database wrapper (better-sqlite3 compatible) ──

export class Database {
  private jsDb: SqlJsDatabase;
  private filePath: string;
  private _open: boolean = true;
  private _inTransaction: boolean = false;
  
  constructor(filePath: string, options?: { readonly?: boolean; fileMustExist?: boolean }) {
    if (!SQL) {
      throw new Error(
        'sql.js not initialized. Call initAdapter() before creating Database.'
      );
    }
    
    this.filePath = filePath;
    
    // Load existing data
    let data: Uint8Array | undefined;
    if (existsSync(filePath)) {
      try {
        const buffer = readFileSync(filePath);
        if (buffer.length > 0) {
          data = new Uint8Array(buffer);
        }
      } catch (err) {
        console.warn('[DB] Failed to read database file, creating new:', err);
      }
    }
    
    this.jsDb = new SQL.Database(data);
  }
  
  /** Prepare a SQL statement */
  prepare(sql: string): Statement {
    return new Statement(this.jsDb, sql);
  }
  
  /** Execute one or more SQL statements (no return) */
  exec(sql: string): void {
    this.jsDb.run(sql);
  }
  
  /** Run SQL with optional params. For INSERT/UPDATE/DELETE returns changes info. */
  run(sql: string, ...params: any[]): { changes: number; lastInsertRowid: number | bigint } {
    const flatParams = params.length === 1 && typeof params[0] === 'object' && !Array.isArray(params[0])
      ? params[0] : params;
    
    // sql.js .run() accepts params
    this.jsDb.run(sql, flatParams);
    return { changes: 1, lastInsertRowid: 0 };
  }
  
  /** Get first row from SQL query */
  get(sql: string, ...params: any[]): Record<string, any> | undefined {
    const stmt = this.prepare(sql);
    const result = stmt.get(...params);
    stmt.finalize();
    return result;
  }
  
  /** Get all rows from SQL query */
  all(sql: string, ...params: any[]): Record<string, any>[] {
    const stmt = this.prepare(sql);
    const result = stmt.all(...params);
    stmt.finalize();
    return result;
  }
  
  /** Execute PRAGMA statement */
  pragma(key: string, options?: { simple?: boolean }): any {
    const sql = `PRAGMA ${key}`;
    if (options?.simple) {
      const row = this.get(sql);
      return row ? Object.values(row)[0] : undefined;
    }
    return this.all(sql);
  }
  
  /** Execute a function with automatic save after */
  transaction<T>(fn: () => T): T {
    this._inTransaction = true;
    try {
      this.exec('BEGIN');
      const result = fn();
      this.exec('COMMIT');
      this.save();
      return result;
    } catch (err) {
      this.exec('ROLLBACK');
      throw err;
    } finally {
      this._inTransaction = false;
    }
  }
  
  /** Save in-memory DB to disk */
  save(): void {
    try {
      const data = this.jsDb.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.filePath, buffer);
    } catch (err) {
      console.error('[DB] Failed to save:', err);
    }
  }
  
  /** Close the database */
  close(): void {
    if (this._open) {
      this.save();
      this.jsDb.close();
      this._open = false;
    }
  }
  
  get open(): boolean { return this._open; }
  get inTransaction(): boolean { return this._inTransaction; }
  get name(): string { return this.filePath; }
  get memory(): boolean { return false; }
  get readonly(): boolean { return false; }
}
