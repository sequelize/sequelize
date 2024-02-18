import { formatDb2StyleLimitOffset } from '../../utils/sql.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { Db2Dialect } from './index.js';

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
