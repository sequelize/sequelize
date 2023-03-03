import type { Sequelize } from 'src/sequelize';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { CockroachDbDialect } from './index';

export interface CockroachdbConnection extends Connection { }

export class CockroachdbConnectionManager extends AbstractConnectionManager<CockroachdbConnection> {
  private readonly lib;

  constructor(dialect: CockroachDbDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('cockroachdb');
  }
}
