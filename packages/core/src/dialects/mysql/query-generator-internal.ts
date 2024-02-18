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
    return formatMySqlStyleLimitOffset(options, this.queryGenerator);
  }
}
