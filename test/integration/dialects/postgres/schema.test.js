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
        await sequelize.query(`GRANT CREATE ON SCHEMA public TO public;`);
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
        await this.restrictedConnection.authenticate();

        // query interfaces
        this.queryInterface = await sequelize.getQueryInterface();
        this.restrictedUserQI = await this.restrictedConnection.getQueryInterface();
      });

      afterEach(async () => {
        await sequelize.query(`GRANT CREATE ON SCHEMA public TO public;`);

        const qi = sequelize.getQueryInterface();
        await qi.dropTable({ schema: 'public',     tableName: 'my_test_table' });
        await qi.dropTable({ schema: 'testschema', tableName: 'my_test_table' });
        await qi.dropTable({ schema: 'public',     tableName: 'shouldnt_create' });
        await qi.dropTable({ schema: 'testschema', tableName: 'shouldnt_create' });
        await sequelize.dropSchema('testschema');
        await sequelize.query(`DROP USER IF EXISTS ${restricted.username};`);
      });

      it('prevents an unauthorized user from creating tables in public schema', async () => {
        // In Postgres exists a restricted 'public' role by default, which can't be deleted.
        //   Everyone user inherits from it. Permissions are additive, which means users
        //   can be revoked permissions individually, while still inheriting public's
        //   permissions. But permissions can be removed from the 'public' role, which users
        //   inherit.
        // Remove 'public' role's permission from 'public' schema:
        await sequelize.query(`REVOKE CREATE ON SCHEMA public FROM public;`);

        await expect(this.restrictedUserQI.createTable(
          'shouldnt_create',
          { name: DataTypes.STRING },
          { schema: 'public' },
        )).to.be.rejectedWith(Error);
      });

      it('allows an authorized user to create tables in a protected schema', async () => {
        // Create table in schema
        const response = this.restrictedUserQI.createTable(
          'my_test_table',
          { name: DataTypes.STRING },
          { schema: 'testschema' },
        );
        await expect(response).to.eventually.be.fulfilled;

        // Retrieve tables in schema
        let tableNames = await this.restrictedUserQI.showAllTables({ schema: 'testschema' });
        if (tableNames?.[0]?.tableName) {
          tableNames = tableNames.map(v => v.tableName);
        }

        expect(tableNames).to.deep.equal(['my_test_table']);
      });

      it('prevents an unauthorized user from creating tables in a protected schema', async () => {
        await sequelize.query(`REVOKE CREATE ON SCHEMA testschema FROM ${restricted.username};`);

        await expect(
          // Create table in schema
          this.restrictedUserQI.createTable(
            'my_test_table',
            { name: DataTypes.STRING },
            { schema: 'testschema' },
          ),
        ).to.be.rejectedWith(Error);

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
