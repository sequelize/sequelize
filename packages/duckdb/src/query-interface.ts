import { AbstractQueryInterface, Model, QiInsertOptions, TableName } from "@sequelize/core";
import type { DuckDbDialect } from "./dialect";

export class DuckDbQueryInterface<
  Dialect extends DuckDbDialect = DuckDbDialect,
> extends AbstractQueryInterface<Dialect> {
}
