import type { ColumnsDescription, QueryRawOptions, TableName } from '@sequelize/core';
import { AbstractQueryInterface, QueryTypes } from '@sequelize/core';
import type { SnowflakeDialect } from './dialect.js';

export class SnowflakeQueryInterface<
  Dialect extends SnowflakeDialect = SnowflakeDialect,
> extends AbstractQueryInterface<Dialect> {
  /**
   * Ensure all required sequences are created for AUTOINCREMENT columns
   *
   * Snowflake doesn't support returning the last inserted ID for autoincrement columns.
   * To overcome this, we create a sequence for each autoincrement column,
   * and use it to get the next value.
   *
   * @param table  Table to create
   * @param attributes Object representing a list of normalized table attributes
   * @param [options]
   *
   * @protected
   */
  async ensureSequences(
    table: TableName,
    attributes: Record<string, ColumnsDescription>,
    options: QueryRawOptions,
  ) {
    const keys = Object.keys(attributes);
    const keyLen = keys.length;

    const promises = [];
    for (let i = 0; i < keyLen; i++) {
      const attribute = attributes[keys[i]];
      if (!attribute.autoIncrement) {
        continue;
      }

      const tableName = typeof table === 'string' ? table : table.tableName;
      const seqName = this.quoteIdentifier(this.getSequenceName(tableName, keys[i]));
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
