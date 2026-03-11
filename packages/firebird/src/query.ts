import { AbstractQuery } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { FirebirdConnection } from './connection-manager.js';

const debug = logger.debugContext('sql:firebird');

/**
 * FirebirdQuery
 *
 * Wraps node-firebird's callback-based API into Sequelize's promise-based
 * query interface and maps raw results to Sequelize's expected shapes.
 */
export class FirebirdQuery extends AbstractQuery {
  declare connectionManager: FirebirdConnection;

  getInsertIdField(): string {
    return 'id';
  }

  async run(sql: string, parameters: unknown[]): Promise<unknown> {
    const conn = this.connection as FirebirdConnection;
    this.sql = sql;

    const complete = this._logQuery(sql, debug, parameters);

    const rawRows = await new Promise<unknown[]>((resolve, reject) => {
      conn.query(sql, parameters ?? [], (err, result) => {
        complete();

        if (err) {
          return reject(this.formatError(err as Error & { gdscode?: number }));
        }

        let res: any[] = [];

        if (Array.isArray(result)) {
          res = result;
        } else if (typeof result === 'object' && result !== null) {
          res = [result];
        }

        resolve(res);
      });
    });
    // Normalise rows: lowercase keys + unwrap Buffer blobs
    const rows = rawRows.map(row => this.#normaliseRow(row as Record<string, unknown>));

    return this.#handleResponse(rows);
  }

  // ── Response mapping ─────────────────────────────────────────────────────────

  #handleResponse(rows: Array<Record<string, unknown>>): unknown {
    if (this.isInsertQuery()) {
      if (rows.length > 0) {
        this.handleInsertQuery(rows[0]);

        return [rows[0], 1];
      }

      return [undefined, 1];
    }

    if (this.isUpdateQuery()) {
      return [rows, rows.length];
    }

    if (this.isDeleteQuery()) {
      return rows.length;
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(rows);
    }

    if (this.isDescribeQuery()) {
      const result: Record<string, unknown> = {};
      for (const row of rows) {
        const field = String(row.field ?? row.Field);
        result[field] = {
          type: String(row.type ?? row.Type).toUpperCase(),
          allowNull: (row.null ?? row.Null) === 'YES',
          defaultValue: row.default ?? row.Default ?? null,
          primaryKey: (row.key ?? row.Key) === 'PRI',
        };
      }

      return result;
    }

    if (this.isShowIndexesQuery()) {
      return this.#handleShowIndexes(rows);
    }

    if (this.isCallQuery()) {
      return rows[0] ?? null;
    }

    return rows;
  }

  // ── Show indexes ──────────────────────────────────────────────────────────────

  #handleShowIndexes(rows: Array<Record<string, unknown>>): unknown[] {
    const indexes: Record<string, {
      name: string;
      unique: boolean;
      primary: boolean;
      fields: Array<{ attribute: string; order: string; length: undefined }>;
    }> = {};

    for (const row of rows) {
      const name = String(row.name);

      if (!indexes[name]) {
        indexes[name] = {
          name,
          unique: Boolean(row.unique),
          primary: name.startsWith('RDB$PRIMARY') || name.startsWith('PK_'),
          fields: [],
        };
      }

      indexes[name].fields.push({
        attribute: String(row.column_name),
        order: row.descending ? 'DESC' : 'ASC',
        length: undefined,
      });
    }

    return Object.values(indexes);
  }

  // ── Row normalisation ─────────────────────────────────────────────────────────

  #normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(row)) {
      out[k.toLowerCase()] = v instanceof Buffer ? v.toString('utf8') : v;
    }

    out.dataValues = out;
    out._previousDataValues = {};

    return out;
  }

  // ── Error formatting ──────────────────────────────────────────────────────────

  override formatError<T extends Error>(err: T & { gdscode?: number; sql?: string }): T {
    err.sql = this.sql;

    const msg = err.message ?? '';
    const { gdscode } = err;

    // Unique / primary key violation
    if (gdscode === 335_544_665 || /violation of primary or unique key/i.test(msg)) {
      const { UniqueConstraintError } = require('@sequelize/core');

      return new UniqueConstraintError({ parent: err, message: msg, sql: this.sql }) as unknown as T;
    }

    // Foreign key violation
    if (gdscode === 335_544_466 || /violation of foreign key constraint/i.test(msg)) {
      const { ForeignKeyConstraintError } = require('@sequelize/core');

      return new ForeignKeyConstraintError({ parent: err, message: msg, sql: this.sql }) as unknown as T;
    }

    // NULL constraint
    if (/validation error for column/i.test(msg) && /null/i.test(msg)) {
      const { ValidationError, ValidationErrorItem } = require('@sequelize/core');

      return new ValidationError(msg, [
        new ValidationErrorItem(msg, 'notNull violation', ''),
      ]) as unknown as T;
    }

    const { DatabaseError } = require('@sequelize/core');

    return new DatabaseError(err) as unknown as T;
  }
}
