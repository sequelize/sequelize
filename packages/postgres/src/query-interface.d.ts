import type { PostgresDialect } from './dialect.js';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.internal.js';

export class PostgresQueryInterface<
  Dialect extends PostgresDialect = PostgresDialect,
> extends PostgresQueryInterfaceTypescript<Dialect> {}
