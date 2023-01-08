import type { Sequelize } from '../../sequelize.js';
import { createUnspecifiedOrderedBindCollector } from '../../utils/sql';
import { AbstractDialect } from '../abstract';
import { IBMiConnectionManager } from './connection-manager';
import * as DataTypes from './data-types.js';
import { IBMiQuery } from './query';
import { IBMiQueryGenerator } from './query-generator';
import { IBMiQueryInterface } from './query-interface';

export class IBMiDialect extends AbstractDialect {

  static supports = AbstractDialect.extendSupport(
    {
      'VALUES ()': true,
      'ON DUPLICATE KEY': false,
      transactions: false,
      bulkDefault: true,
      index: {
        using: false,
        where: true,
        functionBased: true,
        collate: false,
        include: false,
      },
      constraints: {
        onUpdate: false,
      },
      groupedLimit: false,
      upserts: false,
      schemas: true,
      dataTypes: {
        COLLATE_BINARY: true,
      },
    },
  );

  readonly connectionManager: IBMiConnectionManager;
  readonly queryGenerator: IBMiQueryGenerator;
  readonly queryInterface: IBMiQueryInterface;

  readonly dataTypesDocumentationUrl = 'https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm';
  readonly defaultVersion = '7.3.0';
  readonly Query = IBMiQuery;
  readonly TICK_CHAR = '"';
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';
  /**
   * IBMI can take most object names upto 128 characters
   *
   * @see https://www.ibm.com/docs/en/informix-servers/12.10?topic=SSGU8G_12.1.0/com.ibm.dbdk.doc/ids_dbdk_078.html
   */
  readonly MAX_ALIAS_LENGTH = 128;

  constructor(sequelize: Sequelize) {
    super(sequelize, DataTypes, 'ibmi');

    this.connectionManager = new IBMiConnectionManager(this, sequelize);
    this.queryGenerator = new IBMiQueryGenerator({
      dialect: this,
      sequelize,
    });
    this.queryInterface = new IBMiQueryInterface(this.sequelize, this.queryGenerator);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    return `BLOB(X'${buffer.toString('hex')}')`;
  }

  getDefaultSchema(): string {
    // TODO: what is the default schema in IBMi?
    return '';
  }

  static getDefaultPort() {
    return 25_000;
  }
}
