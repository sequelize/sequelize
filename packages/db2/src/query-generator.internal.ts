import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { formatDb2StyleLimitOffset } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { Db2Dialect } from './dialect.js';

const TECHNICAL_SCHEMA_NAMES = Object.freeze(['ERRORSCHEMA', 'NULLID', 'SQLJ']);

export class Db2QueryGeneratorInternal<
  Dialect extends Db2Dialect = Db2Dialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames(): readonly string[] {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions) {
    return formatDb2StyleLimitOffset(options, this.queryGenerator);
  }
}
