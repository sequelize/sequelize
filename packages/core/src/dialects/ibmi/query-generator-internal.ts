import { formatDb2StyleLimitOffset } from '../../utils/sql.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '../abstract/query-generator.types.js';
import type { IBMiDialect } from './index.js';

export class IBMiQueryGeneratorInternal<
  Dialect extends IBMiDialect = IBMiDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
  addLimitAndOffset(options: AddLimitOffsetOptions) {
    return formatDb2StyleLimitOffset(options, this.queryGenerator);
  }
}
