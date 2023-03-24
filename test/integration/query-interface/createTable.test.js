'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('createTable', () => {
    it('should create a auto increment primary key', async function() {
      await this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });

      const result = await this.queryInterface.describeTable('TableWithPK');

      if (['mssql', 'mysql', 'mariadb'].includes(dialect)) {
        expect(result.table_id.autoIncrement).to.be.true;
      } else if (dialect === 'postgres') {
        expect(result.table_id.defaultValue).to.equal('nextval("TableWithPK_table_id_seq"::regclass)');
      }
    });

    it('should create unique constraint with uniqueKeys', async function() {
      await this.queryInterface.createTable('MyTable', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: DataTypes.STRING
        },
        email: {
          type: DataTypes.STRING
        }
      }, {
        uniqueKeys: {
          myCustomIndex: {
            fields: ['name', 'email']
          },
          myOtherIndex: {
            fields: ['name']
          }
        }
      });

      const indexes = await this.queryInterface.showIndex('MyTable');
      switch (dialect) {
        case 'postgres':
        case 'postgres-native':
        case 'sqlite':
        case 'mssql':

          // name + email
          expect(indexes[0].unique).to.be.true;
          expect(indexes[0].fields[0].attribute).to.equal('name');
          expect(indexes[0].fields[1].attribute).to.equal('email');

          // name
          expect(indexes[1].unique).to.be.true;
          expect(indexes[1].fields[0].attribute).to.equal('name');
          break;
        case 'mariadb':
        case 'mysql':
        case 'db2':
        case 'oracle':         
          // name + email
          expect(indexes[1].unique).to.be.true;
          expect(indexes[1].fields[0].attribute).to.equal('name');
          expect(indexes[1].fields[1].attribute).to.equal('email');

          // name
          expect(indexes[2].unique).to.be.true;
          expect(indexes[2].fields[0].attribute).to.equal('name');
          break;
        default:
          throw new Error(`Not implemented fpr ${dialect}`);
      }
    });

    it('should work with schemas', async function() {
      await this.sequelize.createSchema('hero');

      await this.queryInterface.createTable('User', {
        name: {
          type: DataTypes.STRING
        }
      }, {
        schema: 'hero'
      });
    });

    describe('enums', () => {
      it('should work with enums (1)', async function() {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: DataTypes.ENUM('value1', 'value2', 'value3')
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (2)', async function() {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3']
          }
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (3)', async function() {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3'],
            field: 'otherName'
          }
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (4)', async function() {
        await this.queryInterface.createSchema('archive');

        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3'],
            field: 'otherName'
          }
        }, { schema: 'archive' });

        const table = await this.queryInterface.describeTable('SomeTable', { schema: 'archive' });
        if (dialect.includes('postgres')) {
          expect(table.otherName.special).to.deep.equal(['value1', 'value2', 'value3']);
        }
      });

      it('should work with enums (5)', async function() {
        await this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM(['COMMENT']),
            comment: 'special enum col'
          }
        });

        const table = await this.queryInterface.describeTable('SomeTable');
        if (dialect.includes('postgres')) {
          expect(table.someEnum.special).to.deep.equal(['COMMENT']);
          expect(table.someEnum.comment).to.equal('special enum col');
        }
      });
    });
  });
});
