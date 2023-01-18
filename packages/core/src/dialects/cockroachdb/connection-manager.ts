import type { Sequelize } from '../../sequelize.js';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

export interface CockroachConnection extends Connection {
  __loadDialectModule(moduleName: string): unknown;
}

export class CockroachdbConnectionManager extends AbstractConnectionManager<CockroachConnection> {
  constructor(dialect: any, sequilize: Sequelize) {
    super(dialect, sequilize);

    /**
      * As pg-types says, PostgreSQL returns everything as string
      * Corrects this issue: https://github.com/cockroachdb/sequelize-cockroachdb/issues/50
      */

    const __loadDialectModule = this._loadDialectModule;
    // const __loadDialectModule = super._loadDialectModule;
    this._loadDialectModule = (...args) => {
      const pg: any = __loadDialectModule(...args);
      pg.types.setTypeParser(20, (val: any) => {
        if (val > Number.MAX_SAFE_INTEGER) {
          return String(val);
        }

        return Number.parseInt(val as string, 10);
      });

      return pg;
    };
  }
}
