import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { formatMySqlStyleLimitOffset } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { MySqlDialect } from './dialect.js';

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
  Dialect extends MySqlDialect = MySqlDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames(): readonly string[] {
    return TECHNICAL_SCHEMAS;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions) {
    return formatMySqlStyleLimitOffset(options, this.queryGenerator);
  }

  // BLOB, TEXT and JSON columns can only be indexed through a prefix or a generated column,
  // and spatial columns can only have spatial indexes, which cannot be unique
  canTypeBeUnique(sqlType: string): boolean {
    return !/^(?:(?:TINY|MEDIUM|LONG)?(?:BLOB|TEXT)|JSON|GEOMETRY(?:COLLECTION)?|(?:MULTI)?(?:POINT|LINESTRING|POLYGON))\b/i.test(
      sqlType,
    );
  }
}
