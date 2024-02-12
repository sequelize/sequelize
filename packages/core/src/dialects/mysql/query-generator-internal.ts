import { formatMySqlStyleLimitOffset } from '../../utils/sql.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { MysqlDialect } from './index.js';

const TECHNICAL_SCHEMAS = Object.freeze([
  'MYSQL',
  'INFORMATION_SCHEMA',
  'PERFORMANCE_SCHEMA',
  'SYS',
  'mysql',
  'information_schema',
  'performance_schema',
  'sys',
]);

export class MySqlQueryGeneratorInternal<
  Dialect extends MysqlDialect = MysqlDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames(): readonly string[] {
    return TECHNICAL_SCHEMAS;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions) {
    // Due to https://github.com/sidorares/node-mysql2/issues/1239 we cannot use bind parameters for LIMIT and OFFSET
    return formatMySqlStyleLimitOffset({ ...options, bindParam: undefined }, this.queryGenerator);
  }
}
