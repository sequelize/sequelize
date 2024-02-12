import { MsSqlQueryInterfaceTypescript } from './query-interface-typescript.js';
import type { MssqlDialect } from './index.js';

export class MsSqlQueryInterface<Dialect extends MssqlDialect = MssqlDialect>
  extends MsSqlQueryInterfaceTypescript<Dialect> {}
