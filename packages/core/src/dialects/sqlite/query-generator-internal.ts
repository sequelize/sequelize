import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { SqliteDialect } from './index.js';

export class SqliteQueryGeneratorInternal<
  Dialect extends SqliteDialect = SqliteDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.queryGenerator.escape(options.limit, options)}`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` LIMIT -1`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)}`;
    }

    return fragment;
  }
}
