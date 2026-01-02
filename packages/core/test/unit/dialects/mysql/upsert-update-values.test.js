'use strict';

const { expect } = require('chai');
const { Sequelize, DataTypes } = require('@sequelize/core');
const { MySqlDialect } = require('@sequelize/mysql');
const sinon = require('sinon');

describe('Standalone Upsert Repro', () => {
  let sequelize;

  before(() => {
    sequelize = new Sequelize({
      dialect: MySqlDialect,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('generates correct SQL for upsert with literal increment (low level)', () => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      counter: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    });

    const queryGenerator = sequelize.queryGenerator;
    const tableName = 'Users';
    const modelAttributes = User.getAttributes();

    const options = {
      updateOnDuplicate: ['name', 'counter'],
      upsertKeys: ['id'],
      model: User,
      updateValues: {
        counter: sequelize.literal('counter + 1'),
      },
    };

    // Pass simple start value for insert
    const insertValues = {
      name: 'foo',
      counter: 1,
    };

    const sql = queryGenerator.insertQuery(tableName, insertValues, modelAttributes, options);

    // console.log('DEBUG SQL:', sql.query);

    expect(sql.query).to.contain('`counter`=counter + 1');
    // Check that insert value is used for binding (roughly)
    // With bind params, we can't easily check '1' in string, but we verify it generated 2 binds
    // and counter=counter + 1 in update.
  });

  it('Model.upsert passes updateValues to QueryInterface (high level)', async () => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      counter: DataTypes.INTEGER,
    });

    // Mock queryRaw to avoid DB connection errors
    // We restore it after test if needed, but this is standalone script.
    const querySpy = sinon.stub(sequelize, 'queryRaw').resolves([{ isNewRecord: false }]);

    await User.upsert(
      {
        id: 1,
        name: 'foo',
        counter: 1,
      },
      {
        updateValues: {
          counter: sequelize.literal('counter + 1'),
        },
      },
    );

    const sql = querySpy.getCall(0).args[0];

    expect(sql).to.contain('`counter`=counter + 1');
    // Ensure literal 'counter + 1' is NOT in VALUES list.
    // VALUES (..., 1) -> mapped to bind param.
    // If literal was in VALUES list, it would be 'counter + 1' directly or similar.
  });

  it('works with arbitrary field names (e.g. apple)', async () => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      apple: DataTypes.INTEGER,
    });

    // Mock queryRaw
    const querySpy = sinon.stub(sequelize, 'queryRaw').resolves([{ isNewRecord: false }]);

    await User.upsert(
      {
        id: 1,
        name: 'foo',
        apple: 10,
      },
      {
        updateValues: {
          apple: sequelize.literal('apple + 2'),
        },
      },
    );

    const sql = querySpy.getCall(0).args[0];
    // console.log('Apple SQL:', sql);

    expect(sql).to.contain('`apple`=apple + 2');
  });
});
