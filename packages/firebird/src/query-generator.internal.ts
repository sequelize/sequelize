import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import type { FirebirdDialect } from './dialect';

export class FirebirdQueryGeneratorInternal<
  Dialect extends FirebirdDialect = FirebirdDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalSchemaNames(): readonly string[] {
    return [];
  }

  addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';

    if (options.offset) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)} ROWS`;
    }

    if (options.limit != null) {
      fragment += ` FETCH NEXT ${this.queryGenerator.escape(options.limit, options)} ROWS ONLY`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` FETCH NEXT 18446744073709551615 ROWS ONLY`;
    }

    return fragment;
  }
}
