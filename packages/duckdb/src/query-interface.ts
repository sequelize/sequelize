import { AbstractQueryInterface } from "@sequelize/core";
import type { DuckDbDialect } from "./dialect";
import { DuckDbQueryInterfaceInternal } from "./query-interface.internal";

export class DuckDbQueryInterface<
  Dialect extends DuckDbDialect = DuckDbDialect,
> extends AbstractQueryInterface<Dialect> {
    readonly #internalQueryInterface: DuckDbQueryInterfaceInternal;

    constructor(dialect: Dialect, internalQueryInterface?: DuckDbQueryInterfaceInternal) {
        internalQueryInterface ??= new DuckDbQueryInterfaceInternal(dialect);

        super(dialect, internalQueryInterface);
        this.#internalQueryInterface = internalQueryInterface;
    }
}
