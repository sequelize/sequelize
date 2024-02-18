import type { MssqlDialect } from './index.js';
import { MsSqlQueryInterfaceTypescript } from './query-interface-typescript.js';

export class MsSqlQueryInterface<
  Dialect extends MssqlDialect = MssqlDialect,
> extends MsSqlQueryInterfaceTypescript<Dialect> {}
