import { AbstractQueryInterface } from '../abstract/query-interface.js';
import type { IBMiDialect } from './index.js';

export class IBMiQueryInterface<Dialect extends IBMiDialect = IBMiDialect> extends AbstractQueryInterface<Dialect> {}
