import { DataTypes, Op, sql } from '@sequelize/core';
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

    it('rejects user-defined result types on PostgreSQL 18 VIRTUAL generated columns', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'VirtualEnumResult',
          {
            computed: {
              type: DataTypes.ENUM('one', 'two'),
              generatedAs: sql.literal("'one'"),
              generatedColumn: 'VIRTUAL',
            },
          },
          { timestamps: false },
        );
      }).to.throw(/PostgreSQL.*VIRTUAL generated columns.*ENUM.*user-defined/i);
    });

    it('allows user-defined result types on PostgreSQL STORED generated columns', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'StoredEnumResult',
          {
            computed: {
              type: DataTypes.ENUM('one', 'two'),
              generatedAs: sql.literal("'one'"),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
      }).not.to.throw();
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

    it('rejects a primary key on a PostgreSQL 18 VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define('VirtualPrimaryKey', {
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('1'),
            generatedColumn: 'VIRTUAL',
            primaryKey: true,
          },
        });
      }).to.throw(/primary keys.*VIRTUAL generated columns/i);
    });

    it('rejects a unique constraint on a PostgreSQL 18 VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define('VirtualUnique', {
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('1'),
            generatedColumn: 'VIRTUAL',
            unique: true,
          },
        });
      }).to.throw(/unique constraints.*VIRTUAL generated columns/i);
    });

    it('rejects a foreign key on a PostgreSQL 18 VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define('VirtualForeignKey', {
          computed: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('1'),
            generatedColumn: 'VIRTUAL',
            references: { table: 'parents', key: 'id' },
          },
        });
      }).to.throw(/foreign key constraints.*VIRTUAL generated columns/i);
    });

    it('rejects a model index on a PostgreSQL 18 VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'VirtualIndex',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('1'),
              generatedColumn: 'VIRTUAL',
            },
          },
          { indexes: [{ fields: ['computed'] }] },
        );
      }).to.throw(/indexes.*VIRTUAL generated columns/i);
    });

    it('rediscovers an invalid configured database version before generated DDL', async () => {
      sinon.stub(console, 'warn');

      let postgres: ReturnType<typeof createSequelizeInstance>;
      expect(() => {
        postgres = createSequelizeInstance({ databaseVersion: 'not-a-semantic-version' });
      }).not.to.throw();

      expect(postgres!.getDatabaseVersionIfExist()).to.equal(null);
      expect(postgres!.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(postgres!.dialect.supports.generatedColumns.virtual).to.equal(true);
      const withConnection = sinon.stub(postgres!, 'withConnection').callsFake(async callback => {
        postgres!.setDatabaseVersion('11.0.0');

        return callback({} as never);
      });
      const queryRaw = sinon.stub(postgres!, 'queryRaw').resolves([] as never);

      await expect(
        postgres!.queryInterface.createTable('UnknownVersionGenerated', {
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

    it('rejects an index expression that references a PostgreSQL VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'VirtualExpressionIndex',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              columnName: 'computed_value',
              generatedAs: sql.literal('source + 1'),
              generatedColumn: 'VIRTUAL',
            },
          },
          {
            indexes: [
              {
                name: 'virtual_expression_idx',
                fields: [sql.literal('lower("computed_value")')],
              },
            ],
          },
        );
      }).to.throw(/index expressions.*VIRTUAL generated columns/i);
    });

    it('rejects an index predicate that references a PostgreSQL VIRTUAL generated column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'VirtualPredicateIndex',
          {
            source: DataTypes.INTEGER,
            computed: {
              type: DataTypes.INTEGER,
              columnName: 'computed_value',
              generatedAs: sql.literal('source + 1'),
              generatedColumn: 'VIRTUAL',
            },
          },
          {
            indexes: [{ fields: ['source'], where: { computed: { [Op.gt]: 0 } } }],
          },
        );
      }).to.throw(/index predicates.*VIRTUAL generated columns/i);
    });

    it('allows index expressions and predicates that do not reference a VIRTUAL column', () => {
      const postgres18 = createSequelizeInstance({ databaseVersion: '18.0.0' });

      expect(() => {
        postgres18.define(
          'UnrelatedExpressionIndex',
          {
            source: {
              type: DataTypes.STRING,
              columnName: 'source_value',
            },
            computed: {
              type: DataTypes.INTEGER,
              columnName: 'computed_value',
              generatedAs: sql.literal('length(source)'),
              generatedColumn: 'VIRTUAL',
            },
            lower: {
              type: DataTypes.STRING,
              generatedAs: sql.literal('lower(source)'),
              generatedColumn: 'VIRTUAL',
            },
          },
          {
            indexes: [
              {
                name: 'unrelated_expression_idx',
                fields: [
                  sql.literal(`lower("source_value") || 'computed_value' /* "computed_value" */`),
                ],
                where: { source: 'computed_value' },
              },
            ],
          },
        );
      }).not.to.throw();
    });
  }

  if (dialectName === 'sqlite3') {
    it('preserves the SQLite 3.8 dialect floor', () => {
      expect(sequelize.dialect.minimumDatabaseVersion).to.equal('3.8.0');
    });

    for (const version of ['3.8.0', '3.24.0', '3.30.0']) {
      it(`uses TABLE_INFO on SQLite ${version}`, () => {
        const oldSqlite = createSequelizeInstance({ databaseVersion: version });

        expect(oldSqlite.queryGenerator.describeTableQuery('users')).to.equal(
          'PRAGMA TABLE_INFO(`users`)',
        );
      });
    }

    it('discovers the SQLite version before its first describeTable query', async () => {
      const freshSqlite = createSequelizeInstance();
      const authenticate = sinon.stub(freshSqlite, 'authenticate').callsFake(async () => {
        freshSqlite.setDatabaseVersion('3.24.0');
      });
      const queryRaw = sinon.stub(freshSqlite, 'queryRaw').resolves({ before: {} } as any);
      sinon.stub(freshSqlite.queryInterface, 'showIndex').resolves([]);
      sinon.stub(freshSqlite.queryInterface, 'showConstraints').resolves([]);

      await freshSqlite.queryInterface.describeTable('users');

      expect(authenticate).to.have.been.calledOnce;
      expect(queryRaw.firstCall.args[0]).to.equal('PRAGMA TABLE_INFO(`users`)');
    });

    it('uses the table-rebuild rename fallback before SQLite 3.25', async () => {
      const sqlite324 = createSequelizeInstance({ databaseVersion: '3.24.0' });
      const queryInterface = sqlite324.queryInterface;
      sinon.stub(queryInterface, 'describeTable').resolves({ before: {} } as any);
      sinon.stub(sqlite324, 'queryRaw').callsFake(async query => {
        if (String(query).startsWith('SELECT sql,')) {
          return [
            {
              schemaCatalog: 'sqlite_master',
              sql: 'CREATE TABLE `users` (`before` INTEGER)',
            },
          ] as any;
        }

        return [] as any;
      });
      const fallback = sinon
        .stub(sqlite324.queryGenerator, '_replaceTableQuery')
        .throws(new Error('used rebuild fallback'));

      await expect(queryInterface.renameColumn('users', 'before', 'after')).to.be.rejectedWith(
        'used rebuild fallback',
      );
      expect(fallback).to.have.been.calledOnce;
    });

    it('discovers the SQLite version before its first renameColumn operation', async () => {
      const freshSqlite = createSequelizeInstance();
      const authenticate = sinon.stub(freshSqlite, 'authenticate').callsFake(async () => {
        freshSqlite.setDatabaseVersion('3.24.0');
      });
      sinon.stub(freshSqlite.queryInterface, 'describeTable').resolves({ before: {} } as any);
      sinon.stub(freshSqlite, 'queryRaw').callsFake(async query => {
        if (String(query).startsWith('SELECT sql,')) {
          return [
            {
              schemaCatalog: 'sqlite_master',
              sql: 'CREATE TABLE `users` (`before` INTEGER)',
            },
          ] as any;
        }

        return [] as any;
      });
      const fallback = sinon
        .stub(freshSqlite.queryGenerator, '_replaceTableQuery')
        .throws(new Error('used rebuild fallback'));

      await expect(
        freshSqlite.queryInterface.renameColumn('users', 'before', 'after'),
      ).to.be.rejectedWith('used rebuild fallback');
      expect(authenticate).to.have.been.calledOnce;
      expect(fallback).to.have.been.calledOnce;
    });

    it('uses native column renames starting with SQLite 3.25', async () => {
      const sqlite325 = createSequelizeInstance({ databaseVersion: '3.25.0' });
      const queryRaw = sinon.stub(sqlite325, 'queryRaw');
      queryRaw.onFirstCall().resolves([{ name: 'before' }] as any);
      queryRaw.onSecondCall().resolves([] as any);
      const fallback = sinon.spy(sqlite325.queryGenerator, '_replaceColumnQuery');

      await sqlite325.queryInterface.renameColumn('users', 'before', 'after');

      expect(fallback).not.to.have.been.called;
      expect(queryRaw.secondCall.args[0]).to.equal(
        'ALTER TABLE `users` RENAME COLUMN `before` TO `after`',
      );
    });

    it('requires SQLite 3.31 for generated columns', () => {
      const sqlite330 = createSequelizeInstance({ databaseVersion: '3.30.0' });

      expect(sqlite330.dialect.supports.generatedColumns.stored).to.equal(false);
      expect(sqlite330.dialect.supports.generatedColumns.virtual).to.equal(false);
      expect(() => {
        sqlite330.define(
          'Sqlite330Generated',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('1'),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
      }).to.throw(/sqlite3 3\.31\.0 or newer.*STORED generated columns/i);
    });

    it('discovers the SQLite version before the first generated addColumn operation', async () => {
      const freshSqlite = createSequelizeInstance();
      const authenticate = sinon.stub(freshSqlite, 'authenticate').callsFake(async () => {
        freshSqlite.setDatabaseVersion('3.30.0');
      });
      const queryRaw = sinon.stub(freshSqlite, 'queryRaw').throws(new Error('executed SQL'));

      await expect(
        freshSqlite.queryInterface.addColumn('users', 'computed', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('1'),
          generatedColumn: 'STORED',
        }),
      ).to.be.rejectedWith(/sqlite3 3\.31\.0 or newer.*STORED generated columns/i);
      expect(authenticate).to.have.been.calledOnce;
      expect(queryRaw).not.to.have.been.called;
    });

    it('discovers the SQLite version before the first generated changeColumn operation', async () => {
      const freshSqlite = createSequelizeInstance();
      const authenticate = sinon.stub(freshSqlite, 'authenticate').callsFake(async () => {
        freshSqlite.setDatabaseVersion('3.30.0');
      });
      const queryRaw = sinon.stub(freshSqlite, 'queryRaw').throws(new Error('executed SQL'));

      await expect(
        freshSqlite.queryInterface.changeColumn('users', 'computed', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('1'),
          generatedColumn: 'VIRTUAL',
        }),
      ).to.be.rejectedWith(/sqlite3 3\.31\.0 or newer.*VIRTUAL generated columns/i);
      expect(authenticate).to.have.been.calledOnce;
      expect(queryRaw).not.to.have.been.called;
    });

    it('rejects invalid generated definitions before checking SQLite versions', () => {
      const sqlite330 = createSequelizeInstance({ databaseVersion: '3.30.0' });

      expect(() => {
        sqlite330.define(
          'Sqlite330InvalidGenerated',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: '1' as any,
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
      }).to.throw(/generatedAs.*Sequelize SQL expression/i);
    });

    it('enables generated columns and TABLE_XINFO on SQLite 3.31', () => {
      const sqlite331 = createSequelizeInstance({ databaseVersion: '3.31.0' });

      expect(sqlite331.dialect.supports.generatedColumns.stored).to.equal(true);
      expect(sqlite331.dialect.supports.generatedColumns.virtual).to.equal(true);
      expect(sqlite331.queryGenerator.describeTableQuery('users')).to.equal(
        'PRAGMA TABLE_XINFO(`users`)',
      );
      expect(() => {
        sqlite331.define(
          'Sqlite331Generated',
          {
            computed: {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('1'),
              generatedColumn: 'VIRTUAL',
            },
          },
          { timestamps: false },
        );
      }).not.to.throw();
    });
  }
});
