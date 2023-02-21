// import { Sequelize } from 'src/sequelize';
// import { CockroachDbDialect } from './index';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

export interface CockroachdbConnection extends Connection { }

// type Lib = typeof import('cockroachdb');

export class CockroachdbConnectionManager extends AbstractConnectionManager<CockroachdbConnection> {
  // private readonly lib: Lib;

  // constructor(dialect: CockroachDbDialect, sequelize: Sequelize) {
  //   super(dialect, sequelize);
  //   this.lib = this._loadDialectModule('mariadb') as Lib;
  // }
}
