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

      const seqName = this.quoteIdentifier(this.getSequenceName(table.tableName, keys[i]));
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

  private async getNextPrimaryKeyValue(tableName: string, fieldName: string) {
    const sequenceName = this.getSequenceName(tableName, fieldName);
    const sql = `SELECT ${this.quoteIdentifier(sequenceName)}.nextval AS NEXT_VALUE`;

    const row = await this.sequelize.queryRaw(sql, {
      plain: true,
      raw: true,
      type: QueryTypes.SELECT,
    });

    // @ts-expect-error -- NEXT_VALUE is a valid property of a row
    return row?.NEXT_VALUE;
  }

  private getSequenceName(tableName: string, fieldName: string) {
    return `${tableName}_${fieldName}_seq`;
  }
}
