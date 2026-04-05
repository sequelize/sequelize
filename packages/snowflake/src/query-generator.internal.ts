import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { SnowflakeDialect } from './dialect.js';

const TECHNICAL_SCHEMA_NAMES = Object.freeze([
  'INFORMATION_SCHEMA',
  'PERFORMANCE_SCHEMA',
  'SYS',
  'information_schema',
  'performance_schema',
  'sys',
]);

export class SnowflakeQueryGeneratorInternal<
  Dialect extends SnowflakeDialect = SnowflakeDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions): string {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.queryGenerator.escape(options.limit, options)}`;
    } else if (options.offset) {
      fragment += ` LIMIT NULL`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)}`;
    }

    return fragment;
  }
}
