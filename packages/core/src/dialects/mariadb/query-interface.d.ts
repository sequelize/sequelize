import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MariaDbDialect } from './index.js';

export class MariaDbQueryInterface<Dialect extends MariaDbDialect = MariaDbDialect>
  extends AbstractQueryInterface<Dialect> {}
