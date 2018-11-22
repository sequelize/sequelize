'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('../../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return Support.dropTestSchemas(this.sequelize);
  });

  describe('describeTable', () => {

    if (Support.sequelize.dialect.supports.schemas) {
      it('reads the metadata of the table with schema', function() {
        const MyTable1 = this.sequelize.define('my_table', {
          username1: DataTypes.STRING
        });

        const MyTable2 = this.sequelize.define('my_table', {
          username2: DataTypes.STRING
        }, { schema: 'test_meta' });

        return this.sequelize.createSchema('test_meta')
          .then(() => {
            return MyTable1.sync({ force: true });
          })
          .then(() => {
            return MyTable2.sync({ force: true });
          })
          .then(() => {
            return this.queryInterface.describeTable('my_tables', 'test_meta');
          })
          .then(metadata => {
            expect(metadata.username2).not.to.be.undefined;
          })
          .then(() => {
            return this.queryInterface.describeTable('my_tables');
          })
          .then(metadata => {
            expect(metadata.username1).not.to.be.undefined;
            return this.sequelize.dropSchema('test_meta');
          });
      });
    }

    it('reads the metadata of the table', function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING,
        city: {
          type: DataTypes.STRING,
          defaultValue: null,
          comment: 'Users City'
        },
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return this.queryInterface.describeTable('_Users').then(metadata => {
          const id = metadata.id;
          const username = metadata.username;
          const city = metadata.city;
          const isAdmin = metadata.isAdmin;
          const enumVals = metadata.enumVals;

          expect(id.primaryKey).to.be.true;

          if (['mysql', 'mssql'].includes(dialect)) {
            expect(id.autoIncrement).to.be.true;
          }

          let assertVal = 'VARCHAR(255)';
          switch (dialect) {
            case 'postgres':
              assertVal = 'CHARACTER VARYING(255)';
              break;
            case 'mssql':
              assertVal = 'NVARCHAR(255)';
              break;
          }
          expect(username.type).to.equal(assertVal);
          expect(username.allowNull).to.be.true;

          switch (dialect) {
            case 'sqlite':
              expect(username.defaultValue).to.be.undefined;
              break;
            default:
              expect(username.defaultValue).to.be.null;
          }

          switch (dialect) {
            case 'sqlite':
              expect(city.defaultValue).to.be.null;
              break;
          }

          assertVal = 'TINYINT(1)';
          switch (dialect) {
            case 'postgres':
              assertVal = 'BOOLEAN';
              break;
            case 'mssql':
              assertVal = 'BIT';
              break;
          }
          expect(isAdmin.type).to.equal(assertVal);
          expect(isAdmin.allowNull).to.be.true;
          switch (dialect) {
            case 'sqlite':
              expect(isAdmin.defaultValue).to.be.undefined;
              break;
            default:
              expect(isAdmin.defaultValue).to.be.null;
          }

          if (dialect.match(/^postgres/)) {
            expect(enumVals.special).to.be.instanceof(Array);
            expect(enumVals.special).to.have.length(2);
          } else if (dialect === 'mysql') {
            expect(enumVals.type).to.eql('ENUM(\'hello\',\'world\')');
          }

          if (dialect === 'postgres' || dialect === 'mysql' || dialect === 'mssql') {
            expect(city.comment).to.equal('Users City');
            expect(username.comment).to.equal(null);
          }
        });
      });
    });

    it('should correctly determine the primary key columns', function() {
      const Country = this.sequelize.define('_Country', {
        code: { type: DataTypes.STRING, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false }
      }, { freezeTableName: true });
      const Alumni = this.sequelize.define('_Alumni', {
        year: { type: DataTypes.INTEGER, primaryKey: true },
        num: { type: DataTypes.INTEGER, primaryKey: true },
        username: { type: DataTypes.STRING, allowNull: false, unique: true },
        dob: { type: DataTypes.DATEONLY, allowNull: false },
        dod: { type: DataTypes.DATEONLY, allowNull: true },
        city: { type: DataTypes.STRING, allowNull: false },
        ctrycod: {
          type: DataTypes.STRING, allowNull: false,
          references: { model: Country, key: 'code' }
        }
      }, { freezeTableName: true });

      return Country.sync({ force: true }).then(() => {
        return this.queryInterface.describeTable('_Country').then(
          metacountry => {
            expect(metacountry.code.primaryKey).to.eql(true);
            expect(metacountry.name.primaryKey).to.eql(false);

            return Alumni.sync({ force: true }).then(() => {
              return this.queryInterface.describeTable('_Alumni').then(
                metalumni => {
                  expect(metalumni.year.primaryKey).to.eql(true);
                  expect(metalumni.num.primaryKey).to.eql(true);
                  expect(metalumni.username.primaryKey).to.eql(false);
                  expect(metalumni.dob.primaryKey).to.eql(false);
                  expect(metalumni.dod.primaryKey).to.eql(false);
                  expect(metalumni.ctrycod.primaryKey).to.eql(false);
                  expect(metalumni.city.primaryKey).to.eql(false);
                });
            });
          });
      });
    });
  });
});
