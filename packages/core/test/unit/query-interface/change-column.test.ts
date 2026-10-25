import type {
  AttributeOptions,
  ColumnsDescription,
  ConstraintDescription,
  IndexDescription,
  Transaction,
} from '@sequelize/core';
import { DataTypes, TransactionNestMode } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  getTestDialect,
  sequelize,
} from '../../support';

const dialectName = getTestDialect();
const supportsUniqueInAlterQuery = sequelize.dialect.supports.alterColumn.unique;

function uniqueConstraint(constraintName: string, columnNames: string[]): ConstraintDescription {
  return {
    constraintSchema: '',
    constraintName,
    constraintType: 'UNIQUE',
    tableSchema: '',
    tableName: 'users',
    columnNames,
  };
}

function index(
  name: string,
  columnNames: string[],
  { unique = true, primary = false } = {},
): IndexDescription {
  return {
    name,
    unique,
    primary,
    fields: columnNames.map(attribute => ({ attribute }) as IndexDescription['fields'][number]),
    includes: undefined,
    tableName: 'users',
    type: undefined,
  };
}

// sqlite3 recreates the table to change a column, see the integration tests
(dialectName === 'sqlite3' ? describe.skip : describe)('QueryInterface#changeColumn', () => {
  const queryInterface = sequelize.queryInterface;

  let queryRawStub: sinon.SinonStub;
  let showConstraintsStub: sinon.SinonStub;
  let showIndexStub: sinon.SinonStub;
  let addConstraintStub: sinon.SinonStub;
  let addIndexStub: sinon.SinonStub;
  let transactionStub: sinon.SinonStub;
  const transaction = {} as Transaction;
  // postgres looks for unique keys in pg_index
  let postgresHasUniqueKey: boolean;

  beforeEach(() => {
    postgresHasUniqueKey = false;
    queryRawStub = sinon
      .stub(sequelize, 'queryRaw')
      .callsFake(async (sql: string): Promise<any> => {
        return sql.startsWith('SELECT EXISTS') ? [{ exists: postgresHasUniqueKey }] : [[], 0];
      });
    showConstraintsStub = sinon.stub(queryInterface, 'showConstraints').resolves([]);
    showIndexStub = sinon.stub(queryInterface, 'showIndex').resolves([]);
    addConstraintStub = sinon.stub(queryInterface, 'addConstraint').resolves();
    addIndexStub = sinon.stub(queryInterface, 'addIndex').resolves();
    transactionStub = sinon
      .stub(sequelize, 'transaction')
      .callsFake(async (_options: unknown, callback: unknown) => {
        return (callback as (transaction: Transaction) => Promise<unknown>)(transaction);
      });

    // Db2 only adds unique constraints to NOT NULL columns
    sinon.stub(queryInterface, 'describeTable').resolves({
      email: { allowNull: false },
    } as unknown as ColumnsDescription);
  });

  afterEach(() => {
    sinon.restore();
  });

  function getAlterCall(): sinon.SinonSpyCall {
    const alterCalls = queryRawStub.getCalls().filter(call => !call.args[0].startsWith('SELECT'));
    expect(alterCalls).to.have.length(1);

    return alterCalls[0];
  }

  function getAlterQuery(): string {
    return getAlterCall().args[0];
  }

  function expectUniqueKeyAdded(added: boolean) {
    const alterQuery = getAlterQuery();
    if (supportsUniqueInAlterQuery) {
      expect(alterQuery.includes('UNIQUE')).to.equal(added);
      expect(addConstraintStub.called).to.equal(false);
    } else {
      expect(alterQuery).not.to.include('UNIQUE');
      expect(addConstraintStub.called).to.equal(added);
    }

    expect(addIndexStub.called).to.equal(false);
  }

  it('does not look for unique keys if unique is not set', async () => {
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING });
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: false });

    expect(queryRawStub.callCount).to.equal(2);
    expect(showConstraintsStub.called).to.equal(false);
    expect(showIndexStub.called).to.equal(false);
    expect(addConstraintStub.called).to.equal(false);
    expect(addIndexStub.called).to.equal(false);
  });

  it('adds a unique key if the column has none', async () => {
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expectUniqueKeyAdded(true);
  });

  it('does not add a unique key if the column already has one', async () => {
    postgresHasUniqueKey = true;
    showIndexStub.resolves([index('users_email', ['email'])]);

    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expectUniqueKeyAdded(false);
  });

  it('throws if unique is not true', async () => {
    const uniqueValues: Array<AttributeOptions['unique']> = [
      'users_email_uk',
      { name: 'users_email_uk' },
      [true],
    ];

    for (const unique of uniqueValues) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique }),
      ).to.be.rejectedWith(TypeError, 'queryInterface.changeColumn only accepts "unique: true"');
    }

    expect(queryRawStub.called).to.equal(false);
  });

  if (!supportsUniqueInAlterQuery) {
    it('passes the query options to the queries that add the unique key', async () => {
      const logging = () => {};

      await queryInterface.changeColumn(
        'users',
        'email',
        { type: DataTypes.STRING, unique: true, field: 'email_address' },
        { logging },
      );

      expect(showConstraintsStub.firstCall.args[1]).to.include({ logging });
      expect(showIndexStub.firstCall.args[1]).to.include({ logging });
      expect(addConstraintStub.firstCall.args[0]).to.equal('users');
      expect(addConstraintStub.firstCall.args[1]).to.deep.include({
        type: 'UNIQUE',
        fields: ['email_address'],
        logging,
      });
      expect(addConstraintStub.firstCall.args[1]).not.to.have.property('name');
    });
  }

  if (dialectName === 'mssql') {
    it('changes the column and adds the unique key in one transaction', async () => {
      await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

      expect(transactionStub.callCount).to.equal(1);
      expect(transactionStub.firstCall.args[0]).to.include({
        nestMode: TransactionNestMode.savepoint,
      });
      expect(getAlterCall().args[1]).to.include({ transaction });
      expect(addConstraintStub.firstCall.args[1]).to.include({ transaction });
    });
  }

  if (dialectName === 'oracle') {
    it('adds the unique key in the same statement as the column change', async () => {
      await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

      expect(getAlterQuery()).to.include(
        `'ALTER TABLE "users" MODIFY "email" NVARCHAR2(255) NULL ADD CONSTRAINT "users_email_uk" UNIQUE ("email")'`,
      );
    });

    it('adds the unique key after the foreign key of the column', async () => {
      await queryInterface.changeColumn('users', 'email', {
        type: DataTypes.INTEGER,
        references: { table: 'teams' },
        unique: true,
      });

      expect(getAlterQuery()).to.include(
        `EXECUTE IMMEDIATE 'ALTER TABLE "users" ADD FOREIGN KEY ("email") REFERENCES "teams" ("id")'; EXECUTE IMMEDIATE 'ALTER TABLE "users" ADD CONSTRAINT "users_email_uk" UNIQUE ("email")';`,
      );
    });
  }

  if (dialectName === 'postgres') {
    it('looks for unique keys in pg_index, ignoring partial unique indexes and unique indexes with expressions', async () => {
      await queryInterface.changeColumn('users', 'email', {
        type: DataTypes.STRING,
        unique: true,
        field: 'email_address',
      });

      const lookup = queryRawStub.firstCall.args[0];
      expect(lookup).to.include(`a.attname = 'email_address'`);
      expect(lookup).to.include('ix.indisunique AND ix.indnkeyatts = 1');
      expect(lookup).to.include('ix.indpred IS NULL AND ix.indexprs IS NULL');
      expect(showConstraintsStub.called).to.equal(false);
      expect(showIndexStub.called).to.equal(false);
    });
  } else {
    it('does not count non-unique indexes and unique keys on more than that column', async () => {
      showIndexStub.resolves([
        index('users_email', ['email'], { unique: false }),
        index('users_email_name', ['email', 'name']),
      ]);
      showConstraintsStub.resolves([uniqueConstraint('users_email_name', ['email', 'name'])]);

      await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

      expectUniqueKeyAdded(true);
    });

    it('counts unique constraints, unique indexes and the primary key', async () => {
      const existingKeys: Array<[ConstraintDescription[], IndexDescription[]]> = [
        [[uniqueConstraint('users_email', ['email'])], []],
        [[], [index('users_email', ['email'])]],
        [[], [index('users_pkey', ['email'], { unique: false, primary: true })]],
      ];

      for (const [constraints, indexes] of existingKeys) {
        queryRawStub.resetHistory();
        showConstraintsStub.resolves(constraints);
        showIndexStub.resolves(indexes);

        // eslint-disable-next-line no-await-in-loop
        await queryInterface.changeColumn('users', 'email', {
          type: DataTypes.STRING,
          unique: true,
        });

        expectUniqueKeyAdded(false);
      }
    });
  }

  describe('with quoteIdentifiers: false', () => {
    allowDeprecationsInSuite(['SEQUELIZE0023']);

    let unquotedSequelize: ReturnType<typeof createSequelizeInstance>;

    before(() => {
      unquotedSequelize = createSequelizeInstance({ quoteIdentifiers: false });
    });

    after(async () => {
      await unquotedSequelize.close();
    });

    it('compares column names case-insensitively', async () => {
      const unquotedQueryInterface = unquotedSequelize.queryInterface;
      const unquotedQueryRawStub = sinon
        .stub(unquotedSequelize, 'queryRaw')
        .callsFake(async (sql: string): Promise<any> => {
          return sql.startsWith('SELECT EXISTS') ? [{ exists: true }] : [[], 0];
        });
      sinon.stub(unquotedQueryInterface, 'showConstraints').resolves([]);
      sinon.stub(unquotedQueryInterface, 'showIndex').resolves([index('USERS_EMAIL', ['EMAIL'])]);
      const unquotedAddConstraintStub = sinon.stub(unquotedQueryInterface, 'addConstraint');

      await unquotedQueryInterface.changeColumn('users', 'Email', {
        type: DataTypes.STRING,
        unique: true,
      });

      const queries = unquotedQueryRawStub.getCalls().map(call => call.args[0]);
      if (dialectName === 'postgres') {
        // postgres folds unquoted identifiers to lower case
        expect(queries[0]).to.include(`a.attname = 'email'`);
      }

      expect(queries.at(-1)).not.to.include('UNIQUE');
      expect(unquotedAddConstraintStub.called).to.equal(false);
    });
  });

  if (dialectName === 'db2') {
    it('adds a unique index instead of a unique constraint to nullable columns', async () => {
      (queryInterface.describeTable as sinon.SinonStub).resolves({
        email: { allowNull: true },
      });

      await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

      expect(addConstraintStub.called).to.equal(false);
      expect(addIndexStub.callCount).to.equal(1);
      expect(addIndexStub.firstCall.args[1]).to.deep.include({
        fields: ['email'],
        unique: true,
        type: undefined,
      });
    });
  }
});
