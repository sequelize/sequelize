import { DataTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { createSequelizeInstance, sequelize } from '../../support';

const queryInterface = sequelize.queryInterface;
const supports = sequelize.dialect.supports.generatedColumns;

describe('QueryInterface generated column validation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('validates generated expressions in createTable', async () => {
    await expect(
      queryInterface.createTable('generated_test', {
        value: {
          type: DataTypes.INTEGER,
          generatedAs: 'source + 1' as any,
          generatedColumn: 'STORED',
        },
      }),
    ).to.be.rejectedWith(/generatedAs.*Sequelize SQL expression/i);
  });

  it('rejects DataTypes.VIRTUAL generated columns in createTable', async () => {
    await expect(
      queryInterface.createTable('generated_test', {
        value: {
          type: DataTypes.VIRTUAL(DataTypes.INTEGER),
          generatedAs: sql.literal('source + 1'),
          generatedColumn: 'STORED',
        },
      }),
    ).to.be.rejectedWith(/cannot use DataTypes\.VIRTUAL/i);
  });

  it('validates generated defaults in addColumn', async () => {
    await expect(
      queryInterface.addColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/cannot have a defaultValue/i);
  });

  it('validates generated auto-increment options in addColumn', async () => {
    await expect(
      queryInterface.addColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/cannot be autoIncrement/i);
  });

  it('validates generated modes in changeColumn', async () => {
    await expect(
      queryInterface.changeColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('source + 1'),
        generatedColumn: 'INVALID' as any,
      }),
    ).to.be.rejectedWith(/must be either "STORED" or "VIRTUAL"/i);
  });

  it('rejects generatedColumn without generatedAs in changeColumn', async () => {
    await expect(
      queryInterface.changeColumn('generated_test', 'value', {
        type: DataTypes.INTEGER,
        generatedColumn: 'STORED',
      }),
    ).to.be.rejectedWith(/requires "generatedAs"/i);
  });

  if (!supports.stored || !supports.virtual) {
    it('rejects generated modes unsupported by the dialect', async () => {
      const unsupportedMode = supports.stored ? 'VIRTUAL' : 'STORED';

      await expect(
        queryInterface.addColumn('generated_test', 'value', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('source + 1'),
          generatedColumn: unsupportedMode,
        }),
      ).to.be.rejectedWith(/does not support (?:STORED |VIRTUAL )?generated columns/i);
    });
  }

  if (sequelize.dialect.name === 'postgres') {
    it('rejects PostgreSQL VIRTUAL generated columns with user-defined result types', async () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });
      sinon.stub(postgres18, 'queryRaw').resolves([] as never);

      await expect(
        postgres18.queryInterface.createTable('generated_test', {
          value: {
            type: DataTypes.ENUM('one', 'two'),
            generatedAs: sql.literal("'one'"),
            generatedColumn: 'VIRTUAL',
          },
        }),
      ).to.be.rejectedWith(/PostgreSQL.*VIRTUAL generated columns.*ENUM.*user-defined/i);
    });

    it('rejects VIRTUAL expressions that reference user-defined source types', async () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });
      const queryRaw = sinon.stub(postgres18, 'queryRaw').resolves([] as never);

      await expect(
        postgres18.queryInterface.createTable('generated_test', {
          source_value: DataTypes.CITEXT,
          value: {
            type: DataTypes.TEXT,
            generatedAs: sql.literal('"source_value"::text'),
            generatedColumn: 'VIRTUAL',
          },
        }),
      ).to.be.rejectedWith(
        /Attribute "value".*VIRTUAL generated column.*attribute "source_value".*CITEXT user-defined/i,
      );
      expect(queryRaw).not.to.have.been.called;
    });

    it('rejects raw user-defined result types with modifiers', async () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });
      const queryRaw = sinon.stub(postgres18, 'queryRaw').resolves([] as never);

      await expect(
        postgres18.queryInterface.createTable('generated_test', {
          value: {
            type: 'public.GEOMETRY(POINT, 4326)',
            generatedAs: sql.literal('ST_SetSRID(ST_MakePoint(1, 1), 4326)'),
            generatedColumn: 'VIRTUAL',
          },
        }),
      ).to.be.rejectedWith(/PostgreSQL.*VIRTUAL generated columns.*GEOMETRY.*user-defined/i);
      expect(queryRaw).not.to.have.been.called;
    });

    it('rejects addColumn expressions that reference existing user-defined columns', async () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });
      const describeTable = sinon.stub(postgres18.queryInterface, 'describeTable').resolves({
        source_value: { type: 'CITEXT' },
      } as never);
      const queryRaw = sinon.stub(postgres18, 'queryRaw').resolves([] as never);

      await expect(
        postgres18.queryInterface.addColumn('generated_test', 'computed', {
          type: DataTypes.TEXT,
          generatedAs: sql.literal('source_value::text'),
          generatedColumn: 'VIRTUAL',
        }),
      ).to.be.rejectedWith(/attribute "source_value".*CITEXT user-defined/i);
      expect(describeTable).to.have.been.calledOnce;
      expect(queryRaw).not.to.have.been.called;
    });

    it('allows addColumn expressions that only reference built-in columns', async () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });
      sinon.stub(postgres18.queryInterface, 'describeTable').resolves({
        source_value: { type: 'TEXT' },
        metadata: { type: 'CITEXT' },
      } as never);
      const queryRaw = sinon.stub(postgres18, 'queryRaw').resolves([] as never);

      await postgres18.queryInterface.addColumn('generated_test', 'computed', {
        type: DataTypes.TEXT,
        generatedAs: sql.literal('upper(source_value)'),
        generatedColumn: 'VIRTUAL',
      });

      expect(queryRaw).to.have.been.calledOnce;
    });
  }
});
