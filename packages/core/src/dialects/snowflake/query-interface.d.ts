import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { SnowflakeDialect } from './index.js';

export class SnowflakeQueryInterface<Dialect extends SnowflakeDialect = SnowflakeDialect>
  extends AbstractQueryInterface<Dialect> {}
