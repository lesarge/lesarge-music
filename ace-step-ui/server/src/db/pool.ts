import Database from 'better-sqlite3';
import { createPool, type Pool as MysqlPool, type PoolConnection as MysqlPoolConnection } from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbConfig = config.database;

// Use MySQL/MariaDB when DB_HOST is configured, otherwise SQLite (local mode).
export const isMysql = !!(dbConfig.host && dbConfig.user && dbConfig.name);

let mysqlPool: MysqlPool | null = null;
let dbInstance: Database.Database | null = null;

if (isMysql) {
  mysqlPool = createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.name,
    waitForConnections: true,
    connectionLimit: 10,
  });
} else {
  // Ensure data directory exists
  const dataDir = path.dirname(dbConfig.path);
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch {
    // Directory already exists
  }

  dbInstance = new Database(dbConfig.path);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');
}

// Convert parameters to SQLite/MySQL-compatible types
function sanitizeParams(params?: unknown[]): unknown[] | undefined {
  if (!params) return params;
  return params.map(p => {
    // Convert undefined to null
    if (p === undefined) return null;
    // Convert boolean to integer (SQLite stores booleans as 0/1)
    if (typeof p === 'boolean') return p ? 1 : 0;
    // Convert arrays and objects to JSON strings
    if (Array.isArray(p) || (typeof p === 'object' && p !== null)) {
      return JSON.stringify(p);
    }
    return p;
  });
}

// Query result type - use 'any' for rows to avoid strict typing issues
interface QueryResult {
  rows: any[];
  rowCount: number;
}

// Translate a datetime('now'[, 'OFFSET UNIT']) expression into MySQL/MariaDB SQL
function mysqlOffsetExpr(offset: string): string {
  const m = offset.match(/^([+-]?\d+)\s+(days?|hours?|minutes?|seconds?)$/i);
  if (!m) return 'UTC_TIMESTAMP()';
  const num = parseInt(m[1], 10);
  const unit = m[2].toLowerCase().replace(/s$/, '').toUpperCase();
  // SQLite 'datetime('now','-7 days')' means "7 days ago" -> subtract.
  if (num >= 0) return `UTC_TIMESTAMP() + INTERVAL ${num} ${unit}`;
  return `UTC_TIMESTAMP() - INTERVAL ${Math.abs(num)} ${unit}`;
}

// Translate SQLite-style SQL to MySQL/MariaDB
function translateMysqlSql(sql: string): string {
  let s = sql.replace(/\$(\d+)/g, '?');
  s = s
    .replace(/datetime\('now'\s*,\s*'([^']+)'\)/gi, (_m, offset) => mysqlOffsetExpr(offset))
    .replace(/datetime\('now'\)/gi, 'UTC_TIMESTAMP()')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/COALESCE/gi, 'COALESCE')
    .replace(/::text/gi, '')
    .replace(/::integer/gi, '')
    .replace(/::boolean/gi, '');
  return s;
}

// Execute a query against MySQL/MariaDB. MariaDB supports INSERT/DELETE RETURNING
// natively but NOT UPDATE ... RETURNING, so that case is split into SELECT + UPDATE.
async function mysqlExecute(conn: MysqlPoolConnection | MysqlPool, sql: string, params?: unknown[]): Promise<QueryResult> {
  const cleanSql = translateMysqlSql(sql);
  const cleanParams = params ? sanitizeParams(params) : [];

  const updRet = cleanSql.match(
    /^\s*UPDATE\s+([A-Za-z0-9_]+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+?)\s+RETURNING\s+([\s\S]+?)\s*$/i
  );
  if (updRet) {
    const table = updRet[1];
    const sets = updRet[2];
    const where = updRet[3];
    const cols = updRet[4];
    const setParamCount = (sets.match(/\?/g) || []).length;
    const whereParams = cleanParams.slice(setParamCount);
    const [before] = await conn.query(`SELECT ${cols} FROM ${table} WHERE ${where}`, whereParams);
    await conn.query(`UPDATE ${table} SET ${sets} WHERE ${where}`, cleanParams);
    const rows = before as any[];
    return { rows, rowCount: rows.length };
  }

  const [result] = await conn.query(cleanSql, cleanParams);
  if (Array.isArray(result)) {
    const rows = result as any[];
    return { rows, rowCount: rows.length };
  }
  const ok = result as { affectedRows?: number };
  return { rows: [], rowCount: ok.affectedRows ?? 0 };
}

// Convert SQL and execute (SQLite path)
function executeQuery(sql: string, params?: unknown[], dbRef: Database.Database = dbInstance!): QueryResult {
  // Sanitize parameters for SQLite
  const sanitizedParams = sanitizeParams(params);

  // Convert PostgreSQL $1, $2 placeholders to SQLite ?
  let convertedSql = sql;
  if (sanitizedParams && sanitizedParams.length > 0) {
    // Replace $N with ?
    convertedSql = sql.replace(/\$(\d+)/g, '?');
  }

  // Handle common PostgreSQL -> SQLite conversions
  convertedSql = convertedSql
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
    .replace(/COALESCE/gi, 'COALESCE')
    .replace(/::text/gi, '')
    .replace(/::integer/gi, '')
    .replace(/::boolean/gi, '')
    .replace(/GREATEST\(([^,]+),\s*(\d+)\)/gi, 'MAX($1, $2)');

  // Auto-generate UUID for INSERT statements that need an id
  const insertMatch = convertedSql.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/i);
  if (insertMatch) {
    const tableName = insertMatch[1];
    const columns = insertMatch[2].split(',').map(c => c.trim().toLowerCase());

    // Tables that need auto-generated IDs
    const tablesNeedingId = ['users', 'songs', 'playlists', 'generation_jobs', 'video_jobs', 'comments', 'reference_tracks', 'contact_submissions'];

    if (tablesNeedingId.includes(tableName.toLowerCase()) && !columns.includes('id')) {
      // Add id to the INSERT
      const newId = randomUUID();
      const updatedColumns = 'id, ' + insertMatch[2];
      const valuesMatch = convertedSql.match(/VALUES\s*\(([^)]+)\)/i);
      if (valuesMatch) {
        const updatedValues = `VALUES ('${newId}', ${valuesMatch[1]})`;
        convertedSql = convertedSql.replace(/\([^)]+\)\s*VALUES/i, `(${updatedColumns}) VALUES`);
        convertedSql = convertedSql.replace(/VALUES\s*\([^)]+\)/i, updatedValues);
      }
    }
  }

  try {
    // Determine if it's a SELECT/returning query
    const isSelect = /^\s*(SELECT|RETURNING)/i.test(convertedSql) ||
                     convertedSql.includes('RETURNING');

    if (isSelect || convertedSql.includes('RETURNING')) {
      const stmt = dbRef.prepare(convertedSql);
      const rows = sanitizedParams ? stmt.all(...sanitizedParams) : stmt.all();
      return { rows, rowCount: rows.length };
    } else {
      const stmt = dbRef.prepare(convertedSql);
      const result = sanitizedParams ? stmt.run(...sanitizedParams) : stmt.run();
      return { rows: [], rowCount: result.changes };
    }
  } catch (error) {
    console.error('SQLite query error:', error);
    console.error('SQL:', convertedSql);
    console.error('Params:', sanitizedParams);
    throw error;
  }
}

// Client-like interface for transaction support (SQLite)
class SqliteClient {
  private inTransaction = false;

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    return executeQuery(sql, params, dbInstance!);
  }

  release() {
    // No-op for SQLite - connection doesn't need to be released
    if (this.inTransaction) {
      // If released while in transaction, rollback
      try {
        dbInstance!.exec('ROLLBACK');
      } catch {
        // Ignore if no transaction
      }
      this.inTransaction = false;
    }
  }
}

// Client-like interface for transaction support (MySQL/MariaDB)
class MysqlClient {
  constructor(private conn: MysqlPoolConnection) {}

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const upperSql = sql.trim().toUpperCase();
    if (upperSql === 'BEGIN') {
      await this.conn.beginTransaction();
      return { rows: [], rowCount: 0 };
    }
    if (upperSql === 'COMMIT') {
      await this.conn.commit();
      return { rows: [], rowCount: 0 };
    }
    if (upperSql === 'ROLLBACK') {
      await this.conn.rollback();
      return { rows: [], rowCount: 0 };
    }
    return mysqlExecute(this.conn, sql, params);
  }

  release() {
    this.conn.release();
  }
}

// Helper for compatibility with existing code that expects pool-like interface
export const pool = {
  query: async (sql: string, params?: unknown[]): Promise<QueryResult> => {
    if (isMysql && mysqlPool) return mysqlExecute(mysqlPool, sql, params);
    return executeQuery(sql, params);
  },

  // For transaction support (used by like endpoint)
  connect: async () => {
    if (isMysql && mysqlPool) {
      const conn = await mysqlPool.getConnection();
      return new MysqlClient(conn);
    }
    const client = new SqliteClient();
    // Override query to handle BEGIN/COMMIT/ROLLBACK
    const originalQuery = client.query.bind(client);
    client.query = async (sql: string, params?: unknown[]) => {
      const upperSql = sql.trim().toUpperCase();
      if (upperSql === 'BEGIN') {
        dbInstance!.exec('BEGIN IMMEDIATE');
        (client as any).inTransaction = true;
        return { rows: [], rowCount: 0 };
      }
      if (upperSql === 'COMMIT') {
        dbInstance!.exec('COMMIT');
        (client as any).inTransaction = false;
        return { rows: [], rowCount: 0 };
      }
      if (upperSql === 'ROLLBACK') {
        dbInstance!.exec('ROLLBACK');
        (client as any).inTransaction = false;
        return { rows: [], rowCount: 0 };
      }
      return originalQuery(sql, params);
    };
    return client;
  },

  end: async () => {
    if (isMysql && mysqlPool) {
      await mysqlPool.end();
    } else {
      dbInstance!.close();
    }
  }
};
