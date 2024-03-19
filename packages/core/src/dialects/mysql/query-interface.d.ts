import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MySqlDialect } from './index.js';

export class MySqlQueryInterface<
  Dialect extends MySqlDialect = MySqlDialect,
> extends AbstractQueryInterface<Dialect> {}
