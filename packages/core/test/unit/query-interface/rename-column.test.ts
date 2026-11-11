import { markGeneratedDefaultColumn } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('QueryInterface#renameColumn', () => {
  afterEach(() => {
    sinon.restore();
  });

  if (dialectName === 'mysql' || dialectName === 'mariadb') {
    it('preserves CURRENT_TIMESTAMP defaults without quotes', async () => {
      sinon.stub(sequelize.queryInterface, 'describeTable').resolves({
        createdAt: {
          type: 'DATETIME',
          allowNull: false,
          defaultValue: dialectName === 'mariadb' ? 'current_timestamp()' : 'CURRENT_TIMESTAMP',
          primaryKey: false,
          autoIncrement: false,
          comment: null,
        },
        updatedAt: {
          type: 'TIMESTAMP(6)',
          allowNull: false,
          defaultValue:
            dialectName === 'mariadb' ? 'current_timestamp(6)' : 'CURRENT_TIMESTAMP(6)',
          primaryKey: false,
          autoIncrement: false,
          comment: null,
        },
      });
      const queryStub = sinon.stub(sequelize, 'queryRaw').resolves([]);

      await sequelize.queryInterface.renameColumn('sample_table', 'createdAt', 'created_on');
      await sequelize.queryInterface.renameColumn('sample_table', 'updatedAt', 'updated_on');

      expect(queryStub.callCount).to.eq(2);
      expectsql(queryStub.getCall(0).args[0], {
        default:
          'ALTER TABLE `sample_table` CHANGE `createdAt` `created_on` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;',
      });
      expectsql(queryStub.getCall(1).args[0], {
        default:
          'ALTER TABLE `sample_table` CHANGE `updatedAt` `updated_on` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);',
      });
    });

    it('wraps marked expression defaults such as uuid() in parentheses', async () => {
      const idColumn = {
        type: 'CHAR(36)',
        allowNull: false,
        defaultValue: 'uuid()',
        primaryKey: true,
        autoIncrement: false,
        comment: null,
      };
      markGeneratedDefaultColumn(idColumn);

      sinon.stub(sequelize.queryInterface, 'describeTable').resolves({ id: idColumn });
      const queryStub = sinon.stub(sequelize, 'queryRaw').resolves([]);

      await sequelize.queryInterface.renameColumn('sample_table', 'id', 'uuid_col');

      expect(queryStub.callCount).to.eq(1);
      expectsql(queryStub.getCall(0).args[0], {
        default:
          'ALTER TABLE `sample_table` CHANGE `id` `uuid_col` CHAR(36) NOT NULL DEFAULT (uuid());',
      });
    });

    it('keeps literal CURRENT_TIMESTAMP defaults quoted on non-temporal columns', async () => {
      sinon.stub(sequelize.queryInterface, 'describeTable').resolves({
        label: {
          type: 'VARCHAR(255)',
          allowNull: false,
          defaultValue: 'CURRENT_TIMESTAMP',
          primaryKey: false,
          autoIncrement: false,
          comment: null,
        },
      });
      const queryStub = sinon.stub(sequelize, 'queryRaw').resolves([]);

      await sequelize.queryInterface.renameColumn('sample_table', 'label', 'label_new');

      expect(queryStub.callCount).to.eq(1);
      expectsql(queryStub.getCall(0).args[0], {
        default:
          `ALTER TABLE \`sample_table\` CHANGE \`label\` \`label_new\` VARCHAR(255) NOT NULL DEFAULT 'CURRENT_TIMESTAMP';`,
      });
    });
  }
});
