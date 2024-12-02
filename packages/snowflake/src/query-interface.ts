import { AbstractQueryInterface } from '@sequelize/core';
import type { SnowflakeDialect } from './dialect.js';
import { QueryTypes } from '@sequelize/core';

export class SnowflakeQueryInterface<
  Dialect extends SnowflakeDialect = SnowflakeDialect,
> extends AbstractQueryInterface<Dialect> {
  /**
   * Ensure enum and their values.
   *
   * @param {string} table  Table to create
   * @param {object} attributes Object representing a list of normalized table attributes
   * @param {object} [options]
   * @param {Model}  [model]
   *
   * @protected
   */
  async ensureSequences(table: any, attributes: any, options: any, model: any) {
    const keys = Object.keys(attributes);
    const keyLen = keys.length;

    const promises = [];
    for (let i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      if (!attribute.autoIncrement) {
        continue;
      }

      const seqName = this.quoteIdentifier(`${table.tableName}_${keys[i]}_seq`);
      const sql = `CREATE SEQUENCE IF NOT EXISTS ${seqName}`;
      promises.push(
        this.sequelize.queryRaw(sql, {
          ...options,
          plain: true,
          raw: true,
          type: QueryTypes.RAW,
        }),
      );
    }

    await Promise.all(promises);
  }
}
