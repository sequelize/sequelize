import { AbstractQueryInterface } from "@sequelize/core";
import type { DuckDbDialect } from "./dialect";

export class DuckDbQueryInterface<
  Dialect extends DuckDbDialect = DuckDbDialect,
> extends AbstractQueryInterface<Dialect> {}
