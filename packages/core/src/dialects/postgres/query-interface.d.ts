import { PostgresQueryInterfaceTypescript } from './query-interface-typescript.js';
import type { PostgresDialect } from './index.js';

export class PostgresQueryInterface<Dialect extends PostgresDialect = PostgresDialect>
  extends PostgresQueryInterfaceTypescript<Dialect> {}
