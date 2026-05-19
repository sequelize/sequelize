import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { createSequelizeInstance, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('generated column version support', () => {
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
  }
});
