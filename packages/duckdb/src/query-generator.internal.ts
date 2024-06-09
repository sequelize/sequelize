import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { DuckDbDialect } from './dialect.js';

const TECHNICAL_SCHEMAS = Object.freeze([
  // TBD
  'information_schema',
]);

export class DuckDbQueryGeneratorInternal<
  Dialect extends DuckDbDialect = DuckDbDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMAS;
  }

  addLimitAndOffset(ignoreOptions: AddLimitOffsetOptions) {
    // TBD
    return '';
  }
}
