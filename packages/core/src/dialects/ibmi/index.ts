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
      transactions: false,
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
      finalTable: true,
      insert: {
        defaultValues: true,
        returning: true,
      },
      groupedLimit: false,
      upserts: false,
      schemas: true,
      dataTypes: {
        COLLATE_BINARY: true,
      },
      removeColumn: {
        cascade: true,
      },
      renameTable: {
        changeSchema: false,
        changeSchemaAndTable: false,
      },
      createSchema: {
        authorization: true,
      },
      dropSchema: {
        cascade: true,
        ifExists: true,
      },
    },
  );

  readonly connectionManager: IBMiConnectionManager;
  readonly queryGenerator: IBMiQueryGenerator;
  readonly queryInterface: IBMiQueryInterface;

  readonly dataTypesDocumentationUrl = 'https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm';
  readonly defaultVersion = '7.3.0';
  readonly Query = IBMiQuery;
  readonly TICK_CHAR_LEFT = '"';
  readonly TICK_CHAR_RIGHT = '"';

  constructor(sequelize: Sequelize) {
    console.warn('The IBMi dialect is experimental and usage is at your own risk. Its development is exclusively community-driven and not officially supported by the maintainers.');

    super(sequelize, DataTypes, 'ibmi');

    this.connectionManager = new IBMiConnectionManager(this);
    this.queryGenerator = new IBMiQueryGenerator(this);
    this.queryInterface = new IBMiQueryInterface(this);
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
