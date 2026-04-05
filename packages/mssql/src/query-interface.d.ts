import type { MsSqlDialect } from './dialect.js';
import { MsSqlQueryInterfaceTypescript } from './query-interface-typescript.internal.js';

export class MsSqlQueryInterface<
  Dialect extends MsSqlDialect = MsSqlDialect,
> extends MsSqlQueryInterfaceTypescript<Dialect> {}
