import type { MsSqlDialect } from './index.js';
import { MsSqlQueryInterfaceTypescript } from './query-interface-typescript.js';

export class MsSqlQueryInterface<
  Dialect extends MsSqlDialect = MsSqlDialect,
> extends MsSqlQueryInterfaceTypescript<Dialect> {}
