/* eslint-disable @typescript-eslint/no-invalid-this */

'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe('QueryInterface#bulkInsert', () => {
  beforeEach(async function setupQueryInterface() {
    this.queryInterface = this.sequelize.queryInterface;

    await this.queryInterface.createTable('UsersBulkInsert', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: DataTypes.STRING,
    });
  });

  afterEach(async function dropTestTable() {
    await this.queryInterface.dropTable('UsersBulkInsert');
  });

  it('should insert multiple rows and return inserted data according to dialect', async function testBulkInsert() {
    const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];

    const result = await this.queryInterface.bulkInsert('UsersBulkInsert', rows, {
      returning: true,
    });

    if (['mysql', 'mariadb'].includes(dialect)) {
      // MySQL & MariaDB only return IDs
      expect(result).to.deep.equal([{ id: 1 }, { id: 2 }, { id: 3 }]);
    } else {
      // Postgres, MSSQL, DB2, SQLite return full rows with names
      expect(result).to.deep.equal([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ]);
    }
  });

  it('should return an array even when inserting a single row', async function testSingleRowInsert() {
    const result = await this.queryInterface.bulkInsert(
      'UsersBulkInsert',
      [{ name: 'SingleUser' }],
      {
        returning: true,
      },
    );

    if (['mysql', 'mariadb'].includes(dialect)) {
      expect(result).to.deep.equal([{ id: 1 }]);
    } else {
      expect(result).to.deep.equal([{ id: 1, name: 'SingleUser' }]);
    }
  });
});
