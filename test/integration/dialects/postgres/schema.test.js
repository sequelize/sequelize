'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes, Sequelize } = require('@sequelize/core');
const { Config: config } = require('../../../config/config');
const { sequelize } = require('../../support');

if (dialect.startsWith('postgres')) {

  describe('[POSTGRES Specific] Schema', () => {
    beforeEach(async () => {
      await sequelize.createSchema('testschema');
    });

    afterEach(async () => {
      await sequelize.dropSchema('testschema');
    });

    describe('Permissions', () => {
      /** create a new user that has restricted privileges, isolated to schema */
      const restricted = {
        username: 'restricted_user',
        password: 'restricted_password',
      };

      beforeEach(async () => {
        // create a new user that will have restricted privileges
        await sequelize.query(`DROP USER IF EXISTS ${restricted.username};`);
        await sequelize.query(`CREATE USER ${restricted.username} WITH PASSWORD '${restricted.password}';`);
        await sequelize.query(`REVOKE CREATE ON SCHEMA public FROM ${restricted.username};`);
        await sequelize.query(`GRANT ALL PRIVILEGES ON SCHEMA testschema TO ${restricted.username};`);

        // connect restricted user to database
        this.restrictedConnection = await new Sequelize(
          config[dialect].database,
          restricted.username,
          restricted.password,
          {
            host: config[dialect].host,
            port: config[dialect].port,
            dialect,
            transactionType: 'IMMEDIATE',
          },
        );
        this.restrictedConnection.options.quoteIdentifiers = true;

        // query interfaces
        this.queryInterface = await sequelize.getQueryInterface();
        this.restrictedUserQI = await this.restrictedConnection.getQueryInterface();
      });

      afterEach(async () => {
        const query = await sequelize.getQueryInterface();
        await query.dropTable({ schema: 'public',     tableName: 'my_test_table' });
        await query.dropTable({ schema: 'testschema', tableName: 'my_test_table' });
        await query.dropTable({ schema: 'public',     tableName: 'shouldnt_create' });
        await query.dropTable({ schema: 'testschema', tableName: 'shouldnt_create' });
        await sequelize.dropSchema('testschema');
        await sequelize.query(`DROP USER IF EXISTS ${restricted.username};`);
      });

      it.skip('prevents schema-privileged user from creating public tables', async () => {
        expect(() => {
          this.restrictedUserQI.createTable(
            'shouldnt_create',
            { name: DataTypes.STRING },
            { schema: 'public' },
          );
        }).to.throw(); // or to.be.rejected
      });

      it('allows schema-privileged user to create tables in schema', async () => {
        // Create table in schema
        await this.restrictedUserQI.createTable(
          'my_test_table',
          { name: DataTypes.STRING },
          { schema: 'testschema' },
        );

        // Retrieve tables in schema
        let tableNames = await this.restrictedUserQI.showAllTables({ schema: 'testschema' });
        if (tableNames?.[0]?.tableName) {
          tableNames = tableNames.map(v => v.tableName);
        }

        expect(tableNames).to.deep.equal(['my_test_table']);
      });

      it.skip('prevents schema-privileged from creating tables in protected schema', async () => {
        await sequelize.query(`REVOKE CREATE PRIVILEGES ON SCHEMA testschema FROM ${restricted.username};`);

        expect(() => {
          // Create table in schema
          this.restrictedUserQI.createTable(
            'my_test_table',
            { name: DataTypes.STRING },
            { schema: 'testschema' },
          );
        }).to.throw();

        // Retrieve tables in schema
        let tableNames = await this.restrictedUserQI.showAllTables({ schema: 'testschema' });
        if (tableNames?.[0]?.tableName) {
          tableNames = tableNames.map(v => v.tableName);
        }

        expect(tableNames).not.to.deep.equal(['my_test_table']);
      });
    });
  });
}
