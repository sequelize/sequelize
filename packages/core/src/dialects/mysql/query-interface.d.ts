import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { MysqlDialect } from './index.js';

export class MySqlQueryInterface<Dialect extends MysqlDialect = MysqlDialect> extends AbstractQueryInterface<Dialect> {}
