import type { ColumnsDescription, ConstraintDescription, IndexDescription } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

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

describe('QueryInterface#changeColumn', () => {
  // sqlite3 recreates the table to change a column, see the integration tests
  if (dialectName === 'sqlite3') {
    return;
  }

  const queryInterface = sequelize.queryInterface;

  let queryRawStub: sinon.SinonStub;
  let showConstraintsStub: sinon.SinonStub;
  let showIndexStub: sinon.SinonStub;
  let addConstraintStub: sinon.SinonStub;
  let addIndexStub: sinon.SinonStub;

  beforeEach(() => {
    queryRawStub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    showConstraintsStub = sinon.stub(queryInterface, 'showConstraints').resolves([]);
    showIndexStub = sinon.stub(queryInterface, 'showIndex').resolves([]);
    addConstraintStub = sinon.stub(queryInterface, 'addConstraint').resolves();
    addIndexStub = sinon.stub(queryInterface, 'addIndex').resolves();

    // Db2 only adds unique constraints to NOT NULL columns
    sinon.stub(queryInterface, 'describeTable').resolves({
      email: { allowNull: false },
    } as unknown as ColumnsDescription);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('does not put UNIQUE in the ALTER COLUMN query', async () => {
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expect(queryRawStub.callCount).to.equal(1);
    expect(queryRawStub.firstCall.args[0]).not.to.match(/UNIQUE/);
  });

  it('does not look for unique keys if unique is not set', async () => {
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING });
    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: false });

    expect(showConstraintsStub.called).to.equal(false);
    expect(showIndexStub.called).to.equal(false);
    expect(addConstraintStub.called).to.equal(false);
    expect(addIndexStub.called).to.equal(false);
  });

  it('adds a unique constraint if the column has no unique key', async () => {
    const logging = () => {};

    showIndexStub.resolves([
      index('users_pkey', ['id'], { primary: true }),
      index('users_email', ['email'], { unique: false }),
      index('users_email_name', ['email', 'name']),
    ]);
    showConstraintsStub.resolves([uniqueConstraint('users_email_name', ['email', 'name'])]);

    await queryInterface.changeColumn(
      'users',
      'email',
      { type: DataTypes.STRING, unique: true },
      { logging },
    );

    expect(showConstraintsStub.firstCall.args[1]).to.include({
      constraintType: 'UNIQUE',
      logging,
    });
    expect(showIndexStub.firstCall.args[1]).to.include({ logging });
    expect(addIndexStub.called).to.equal(false);
    expect(addConstraintStub.callCount).to.equal(1);
    expect(addConstraintStub.firstCall.args[0]).to.equal('users');
    expect(addConstraintStub.firstCall.args[1]).to.deep.include({
      type: 'UNIQUE',
      fields: ['email'],
      logging,
    });
    expect(addConstraintStub.firstCall.args[1]).not.to.have.property('name');
  });

  it('uses the column name of the attribute', async () => {
    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: true,
      field: 'email_address',
    });

    expect(addConstraintStub.firstCall.args[1]).to.deep.include({ fields: ['email_address'] });
  });

  it('names the unique constraint using the unique option', async () => {
    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: 'users_email_uk',
    });
    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: { name: 'users_email_uk' },
    });
    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: [true, { name: 'users_email_uk' }],
    });

    expect(addConstraintStub.callCount).to.equal(3);
    for (const call of addConstraintStub.getCalls()) {
      expect(call.args[1]).to.deep.include({
        type: 'UNIQUE',
        fields: ['email'],
        name: 'users_email_uk',
      });
    }
  });

  it('does not add a unique key if the column has a unique constraint', async () => {
    showConstraintsStub.resolves([uniqueConstraint('some_name', ['email'])]);

    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expect(addConstraintStub.called).to.equal(false);
    expect(addIndexStub.called).to.equal(false);
  });

  it('does not add a unique key if the column has a unique index', async () => {
    showIndexStub.resolves([index('some_name', ['email'])]);

    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expect(addConstraintStub.called).to.equal(false);
    expect(addIndexStub.called).to.equal(false);
  });

  it('does not add a unique key if the column is the primary key', async () => {
    showIndexStub.resolves([index('users_pkey', ['email'], { unique: false, primary: true })]);

    await queryInterface.changeColumn('users', 'email', { type: DataTypes.STRING, unique: true });

    expect(addConstraintStub.called).to.equal(false);
  });

  it('does not add a unique key if a unique key with the requested name exists', async () => {
    showIndexStub.resolves([index('users_email_name', ['email', 'name'])]);

    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: 'users_email_name',
    });

    expect(addConstraintStub.called).to.equal(false);

    showIndexStub.resolves([]);
    showConstraintsStub.resolves([uniqueConstraint('users_email_name', ['email', 'name'])]);

    await queryInterface.changeColumn('users', 'email', {
      type: DataTypes.STRING,
      unique: 'users_email_name',
    });

    expect(addConstraintStub.called).to.equal(false);
  });

  if (dialectName === 'db2') {
    it('adds a unique index instead of a unique constraint to nullable columns', async () => {
      (queryInterface.describeTable as sinon.SinonStub).resolves({
        email: { allowNull: true },
      });

      await queryInterface.changeColumn('users', 'email', {
        type: DataTypes.STRING,
        unique: 'users_email_uk',
      });

      expect(addConstraintStub.called).to.equal(false);
      expect(addIndexStub.callCount).to.equal(1);
      expect(addIndexStub.firstCall.args[1]).to.deep.include({
        fields: ['email'],
        unique: true,
        name: 'users_email_uk',
        type: undefined,
      });
    });
  }
});
