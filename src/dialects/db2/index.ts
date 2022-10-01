import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { Db2ConnectionManager } from './connection-manager';
import * as DataTypes from './data-types.js';
import { Db2Query } from './query';
import { Db2QueryGenerator } from './query-generator';
import { Db2QueryInterface } from './query-interface';

export class Db2Dialect extends AbstractDialect {
  static supports = AbstractDialect.extendSupport({
    migrations: false,
    schemas: true,
    finalTable: true,
    autoIncrement: {
      defaultValue: false,
    },
    alterColumn: {
      unique: false,
    },
    index: {
      collate: false,
      using: false,
      where: true,
    },
    tmpTableTrigger: true,
    dataTypes: {
      COLLATE_BINARY: true,
    },
    milliseconds: true,
  });

  readonly defaultVersion = '1.0.0';
  readonly dataTypesDocumentationUrl = 'https://www.ibm.com/support/knowledgecenter/SSEPGG_11.1.0/com.ibm.db2.luw.sql.ref.doc/doc/r0008478.html';
  readonly connectionManager: Db2ConnectionManager;
  readonly queryGenerator: Db2QueryGenerator;
  readonly queryInterface: Db2QueryInterface;
  readonly Query = Db2Query;

  /** @deprecated */
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'db2');
    this.connectionManager = new Db2ConnectionManager(this, sequelize);
    this.queryGenerator = new Db2QueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new Db2QueryInterface(sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    return `BLOB(${this.queryGenerator.escape(buffer.toString())})`;
  }

  static getDefaultPort() {
    return 3306;
  }
}
