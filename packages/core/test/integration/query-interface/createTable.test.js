'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('createTable', () => {
    it('should create a auto increment primary key', async function () {
      await this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      const result = await this.queryInterface.describeTable('TableWithPK');

      if (['mssql', 'mysql', 'mariadb'].includes(dialect)) {
        expect(result.table_id.autoIncrement).to.be.true;
      } else if (dialect === 'postgres') {
        expect(result.table_id.defaultValue).to.equal(
          'nextval("TableWithPK_table_id_seq"::regclass)',
        );
      }
    });

    // SQLITE does not respect the index name when the index is created through CREATE TABLE
    // As such, Sequelize's createTable does not add the constraint in the Sequelize Dialect.
    // Instead, `sequelize.sync` calls CREATE INDEX after the table has been created,
    // as that query *does* respect the index name.
    if (dialect !== 'sqlite3') {
      it('should create unique constraint with uniqueKeys', async function () {
        await this.queryInterface.createTable(
          'MyTable',
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
            },
            email: {
              type: DataTypes.STRING,
            },
          },
          {
            uniqueKeys: {
              myCustomIndex: {
                fields: ['name', 'email'],
              },
              myOtherIndex: {
                fields: ['name'],
              },
            },
          },
        );

        const indexes = (await this.queryInterface.showIndex('MyTable'))
          .filter(index => !index.primary)
          .sort((a, b) => a.name.localeCompare(b.name));

        for (const index of indexes) {
          index.fields.sort((a, b) => a.attribute.localeCompare(b.attribute));
        }

        // name + email
        expect(indexes[0].unique).to.be.true;
        expect(indexes[0].fields[0].attribute).to.equal('email');
        expect(indexes[0].fields[1].attribute).to.equal('name');

        // name
        expect(indexes[1].unique).to.be.true;
        expect(indexes[1].fields[0].attribute).to.equal('name');
      });
    }

    if (Support.sequelize.dialect.supports.schemas) {
      it('should work with schemas', async function () {
        await this.sequelize.createSchema('hero');

        await this.queryInterface.createTable(
          'User',
          {
            name: {
              type: DataTypes.STRING,
            },
          },
          {
            schema: 'hero',
          },
        );
      });
    }

    describe('enums', () => {
      it('should work with enums (1)', async function () {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: DataTypes.ENUM('value1', 'value2', 'value3'),
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (2)', async function () {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM(['value1', 'value2', 'value3']),
          },
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (3)', async function () {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM(['value1', 'value2', 'value3']),
            field: 'otherName',
          },
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      if (Support.sequelize.dialect.supports.schemas) {
        it('should work with enums (4, schemas)', async function () {
          await this.queryInterface.createSchema('archive');

          await this.queryInterface.createTable(
            'SomeTable',
            {
              someEnum: {
                type: DataTypes.ENUM(['value1', 'value2', 'value3']),
                field: 'otherName',
              },
            },
            { schema: 'archive' },
          );

          const table = await this.queryInterface.describeTable({
            tableName: 'SomeTable',
            schema: 'archive',
          });
          if (dialect.includes('postgres')) {
            expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
          }
        });
      }

      it('should work with enums (5)', async function () {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM(['COMMENT']),
            comment: 'special enum col',
          },
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['COMMENT']);
          expect(table.someEnum.comment).to.equal('special enum col');
        }
      });

      it('should work with multiple enums', async function () {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: DataTypes.ENUM('value1', 'value2', 'value3'),
        });

        // Drop the table, this will leave the enum type behind
        await this.queryInterface.dropTable('SomeTable');

        // Create the table again with a second enum this time
        await this.queryInterface.createTable('SomeTable', {
          someEnum: DataTypes.ENUM('value1', 'value2', 'value3'),
          someOtherEnum: DataTypes.ENUM('otherValue1', 'otherValue2', 'otherValue3'),
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
          expect(table.someOtherEnum.special).to.deep.equal([
            'otherValue1',
            'otherValue2',
            'otherValue3',
          ]);
        }
      });
    });
  });
});
