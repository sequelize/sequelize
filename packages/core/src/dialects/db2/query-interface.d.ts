import type { Db2Dialect } from './index.js';
import { Db2QueryInterfaceTypeScript } from './query-interface-typescript.js';

export class Db2QueryInterface<
  Dialect extends Db2Dialect = Db2Dialect,
> extends Db2QueryInterfaceTypeScript<Dialect> {}
