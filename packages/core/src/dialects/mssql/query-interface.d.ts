import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MssqlDialect } from './index.js';

export class MsSqlQueryInterface<Dialect extends MssqlDialect = MssqlDialect> extends AbstractQueryInterface<Dialect> {}
