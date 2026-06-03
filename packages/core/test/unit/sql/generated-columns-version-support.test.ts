import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('generated column version support', () => {
  afterEach(() => {
    sinon.restore();
  });

  if (dialectName === 'postgres') {
    it('preserves the PostgreSQL 11 dialect floor for models without generated columns', () => {
      expect(sequelize.dialect.minimumDatabaseVersion).to.equal('11.0.0');
    });

    it('requires PostgreSQL 12 for STORED generated columns', () => {
      const postgres11 = createSequelizeInstance({ databaseVersion: '11.0.0' });

      expect(postgres11.dialect.supports.generatedColumns.stored).to.equal(false);

      expect(() => {
        postgres11.define(
          'Postgres11Generated',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('1'),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
      }).to.throw(/PostgreSQL 12\.0\.0 or newer.*STORED generated columns/i);
    });

    it('enables STORED generated columns on PostgreSQL 12', () => {
      const postgres12 = createSequelizeInstance({ databaseVersion: '12.0.0' });

      expect(postgres12.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres12.dialect.supports.generatedColumns.virtual).to.equal(false);
    });

    it('requires PostgreSQL 18 for VIRTUAL generated columns', () => {
      const postgres17 = createSequelizeInstance({ databaseVersion: '17.0.0' });

      expect(postgres17.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres17.dialect.supports.generatedColumns.virtual).to.equal(false);

      expect(() => {
        postgres17.define(
          'Postgres17Generated',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('1'),
              generatedColumn: 'VIRTUAL',
            },
          },
          { timestamps: false },
        );
      }).to.throw(/PostgreSQL 18\.0\.0 or newer.*VIRTUAL generated columns/i);
    });

    it('emits VIRTUAL generated columns on PostgreSQL 18', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(postgres18.dialect.supports.generatedColumns.virtual).to.equal(true);
      const definition = postgres18.queryGenerator.attributeToSQL({
        type: postgres18.normalizeDataType(DataTypes.INTEGER),
        generatedAs: sql.literal('1'),
        generatedColumn: 'VIRTUAL',
      });

      expect(definition).to.equal('INTEGER GENERATED ALWAYS AS (1) VIRTUAL');
    });

    it('re-evaluates generated column support when the database version becomes known', () => {
      const postgres = createSequelizeInstance();
      const supportBeforeConnection = postgres.dialect.supports.generatedColumns;

      expect(supportBeforeConnection.stored).to.equal(true);
      expect(supportBeforeConnection.virtual).to.equal(true);

      postgres.setDatabaseVersion('11.0.0');
      expect(postgres.dialect.supports.generatedColumns).not.to.equal(supportBeforeConnection);
      expect(postgres.dialect.supports.generatedColumns.stored).to.equal(false);
      expect(postgres.dialect.supports.generatedColumns.virtual).to.equal(false);

      postgres.setDatabaseVersion('12.0.0');
      expect(postgres.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres.dialect.supports.generatedColumns.virtual).to.equal(false);

      postgres.setDatabaseVersion('17.0.0');
      expect(postgres.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres.dialect.supports.generatedColumns.virtual).to.equal(false);

      postgres.setDatabaseVersion('18.0.0');
      expect(postgres.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres.dialect.supports.generatedColumns.virtual).to.equal(true);
    });

    it('discovers the server version before validating the first generated DDL operation', async () => {
      const postgres = createSequelizeInstance();
      const withConnection = sinon.stub(postgres, 'withConnection').callsFake(async callback => {
        postgres.setDatabaseVersion('11.0.0');

        return callback({} as never);
      });
      const queryRaw = sinon.stub(postgres, 'queryRaw').resolves([] as never);

      await expect(
        postgres.queryInterface.createTable('generated_first_query', {
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('1'),
            generatedColumn: 'STORED',
          },
        }),
      ).to.be.rejectedWith(/PostgreSQL 12\.0\.0 or newer.*STORED generated columns/i);

      expect(withConnection).to.have.been.calledOnce;
      expect(queryRaw).not.to.have.been.called;
    });

    it('discovers the server version before validating a generated addColumn call', async () => {
      const postgres = createSequelizeInstance();
      const withConnection = sinon.stub(postgres, 'withConnection').callsFake(async callback => {
        postgres.setDatabaseVersion('17.0.0');

        return callback({} as never);
      });
      const queryRaw = sinon.stub(postgres, 'queryRaw').resolves([] as never);

      await expect(
        postgres.queryInterface.addColumn('generated_first_query', 'computed', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('1'),
          generatedColumn: 'VIRTUAL',
        }),
      ).to.be.rejectedWith(/PostgreSQL 18\.0\.0 or newer.*VIRTUAL generated columns/i);

      expect(withConnection).to.have.been.calledOnce;
      expect(queryRaw).not.to.have.been.called;
    });
  }
});
