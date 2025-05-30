import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { HanaDialect } from './dialect.js';

const TECHNICAL_SCHEMA_NAMES = Object.freeze([
  'PUBLIC',
  'SYS',
  //   'SYSTEM', // SYSTEM is technical schema on HANA Cloud, but leads to error on HANA express
  'PAL_CONTENT',
  'PAL_ML_TRACK',
  'PAL_ANNS_CONTENT',
  'PAL_STEM_TFIDF',
  'SAP_PA_APL',
  'BROKER_PO_USER',
  'BROKER_USER',
]);

export class HanaQueryGeneratorInternal<
  Dialect extends HanaDialect = HanaDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions): string {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.queryGenerator.escape(options.limit, options)}`;
    }

    if (options.offset) {
      if (options.limit == null) {
        fragment += ` LIMIT 9223372036854775807`;
      }

      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)}`;
    }

    return fragment;
  }
}
