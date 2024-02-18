import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { PostgresDialect } from './index.js';

const TECHNICAL_DATABASE_NAMES = Object.freeze(['postgres']);
const TECHNICAL_SCHEMA_NAMES = Object.freeze([
  'information_schema',
  'tiger',
  'tiger_data',
  'topology',
]);

export class PostgresQueryGeneratorInternal<
  Dialect extends PostgresDialect = PostgresDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  getTechnicalDatabaseNames() {
    return TECHNICAL_DATABASE_NAMES;
  }

  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions): string {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.queryGenerator.escape(options.limit, options)}`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset, options)}`;
    }

    return fragment;
  }
}
