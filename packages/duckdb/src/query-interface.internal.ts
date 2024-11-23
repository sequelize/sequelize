import type { Sequelize } from "@sequelize/core";
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface-internal.js';
import type { DuckDbDialect } from "./dialect";
import type { DuckDbQueryGenerator } from "./query-generator.js";
import type { DuckDbQueryInterface } from "./query-interface.js";

export class DuckDbQueryInterfaceInternal extends AbstractQueryInterfaceInternal {
    constructor(readonly dialect: DuckDbDialect) {
        super(dialect);
    }

    get #sequelize(): Sequelize {
        return this.dialect.sequelize;
    }

    get #queryGenerator(): DuckDbQueryGenerator {
        return this.dialect.queryGenerator;
    }

    get #queryInterface(): DuckDbQueryInterface {
        return this.dialect.queryInterface;
    }
}
