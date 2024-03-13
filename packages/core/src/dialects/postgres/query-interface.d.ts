import type { PostgresDialect } from './index.js';
import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.js';

export class PostgresQueryInterface<
  Dialect extends PostgresDialect = PostgresDialect,
> extends PostgresQueryInterfaceTypescript<Dialect> {}
