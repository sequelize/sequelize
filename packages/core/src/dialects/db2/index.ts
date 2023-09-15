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
      include: true,
    },
    constraints: {
      onUpdate: false,
    },
    tmpTableTrigger: true,
    dataTypes: {
      COLLATE_BINARY: true,
      TIME: {
        precision: false,
      },
    },
    removeColumn: {
      cascade: true,
    },
  });

  readonly defaultVersion = '1.0.0';
  readonly dataTypesDocumentationUrl = 'https://www.ibm.com/support/knowledgecenter/SSEPGG_11.1.0/com.ibm.db2.luw.sql.ref.doc/doc/r0008478.html';
  readonly connectionManager: Db2ConnectionManager;
  readonly queryGenerator: Db2QueryGenerator;
  readonly queryInterface: Db2QueryInterface;
  readonly Query = Db2Query;

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

    this.registerDataTypeParser(['CHAR () FOR BIT DATA', 'VARCHAR () FOR BIT DATA'], value => {
      return value.toString();
    });

    this.registerDataTypeParser(['TIMESTAMP'], value => {
      // values are returned as UTC, but the UTC Offset is left unspecified.
      return `${value}+00`;
    });
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    return `BLOB(${this.queryGenerator.escape(buffer.toString())})`;
  }

  getDefaultSchema(): string {
    return this.sequelize.config.username.toUpperCase();
  }

  static getDefaultPort() {
    return 3306;
  }
}
