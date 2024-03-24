'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, literal } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('describeTable', () => {
    Support.allowDeprecationsInSuite(['SEQUELIZE0015']);

    if (Support.sequelize.dialect.supports.schemas) {
      it('reads the metadata of the table with schema in object', async function () {
        const MyTable1 = this.sequelize.define('my_table', {
          username1: DataTypes.STRING,
        });

        const MyTable2 = this.sequelize.define(
          'my_table',
          {
            username2: DataTypes.STRING,
          },
          { schema: 'test_meta' },
        );

        await this.sequelize.createSchema('test_meta');
        await MyTable1.sync({ force: true });
        await MyTable2.sync({ force: true });
        const metadata0 = await this.queryInterface.describeTable({
          tableName: 'my_tables',
          schema: 'test_meta',
        });
        expect(metadata0.username2).not.to.be.undefined;
        const metadata = await this.queryInterface.describeTable('my_tables');
        expect(metadata.username1).not.to.be.undefined;
      });

      it('reads the metadata of the table with schema parameter', async function () {
        const MyTable1 = this.sequelize.define('my_table', {
          username1: DataTypes.STRING,
        });

        const MyTable2 = this.sequelize.define(
          'my_table',
          {
            username2: DataTypes.STRING,
          },
          { schema: 'test_meta' },
        );

        await this.sequelize.createSchema('test_meta');
        await MyTable1.sync({ force: true });
        await MyTable2.sync({ force: true });
        const metadata0 = await this.queryInterface.describeTable('my_tables', 'test_meta');
        expect(metadata0.username2).not.to.be.undefined;
        const metadata = await this.queryInterface.describeTable('my_tables');
        expect(metadata.username1).not.to.be.undefined;
      });
    }

    it('rejects when no data is available', async function () {
      const table = this.sequelize.queryGenerator.extractTableDetails('_some_random_missing_table');
      await expect(this.queryInterface.describeTable(table)).to.be.rejectedWith(
        `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
      );
    });

    it('reads the metadata of the table', async function () {
      const Users = this.sequelize.define(
        '_Users',
        {
          username: DataTypes.STRING,
          city: {
            type: DataTypes.STRING,
            defaultValue: null,
            comment: 'Users City',
          },
          isAdmin: DataTypes.BOOLEAN,
          enumVals: DataTypes.ENUM('hello', 'world'),
        },
        { freezeTableName: true },
      );

      await Users.sync({ force: true });
      const metadata = await this.queryInterface.describeTable('_Users');
      const id = metadata.id;
      const username = metadata.username;
      const city = metadata.city;
      const isAdmin = metadata.isAdmin;
      const enumVals = metadata.enumVals;

      expect(id.primaryKey).to.be.true;

      if (['mysql', 'mssql', 'db2'].includes(dialect)) {
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
        case 'sqlite':
          assertVal = 'TEXT';
          break;
        case 'ibmi':
        case 'db2':
          assertVal = 'VARCHAR';
          break;
      }

      expect(username.type).to.equal(assertVal);
      expect(username.allowNull).to.be.true;

      switch (dialect) {
        case 'sqlite':
          expect(username.defaultValue).to.be.undefined;
          break;
        default:
          expect(username.defaultValue).to.eq(null);
      }

      expect(city.defaultValue).to.eq(null);

      assertVal = 'TINYINT(1)';
      switch (dialect) {
        case 'postgres':
        case 'db2':
          assertVal = 'BOOLEAN';
          break;
        case 'sqlite':
          assertVal = 'INTEGER';
          break;
        case 'mssql':
          assertVal = 'BIT';
          break;
        case 'ibmi':
          assertVal = 'SMALLINT';
          break;
      }

      expect(isAdmin.type).to.equal(assertVal);
      expect(isAdmin.allowNull).to.be.true;
      switch (dialect) {
        case 'sqlite':
          expect(isAdmin.defaultValue).to.be.undefined;
          break;
        default:
          expect(isAdmin.defaultValue).to.eql(null);
      }

      if (dialect.startsWith('postgres')) {
        expect(enumVals.special).to.be.instanceof(Array);
        expect(enumVals.special).to.have.length(2);
      } else if (dialect === 'mysql') {
        expect(enumVals.type).to.eql("ENUM('hello','world')");
      }

      if (['postgres', 'mysql', 'mssql'].includes(dialect)) {
        expect(city.comment).to.equal('Users City');
        expect(username.comment).to.equal(null);
      }
    });

    it('should correctly determine the primary key columns', async function () {
      const Country = this.sequelize.define(
        '_Country',
        {
          code: { type: DataTypes.STRING, primaryKey: true },
          name: { type: DataTypes.STRING, allowNull: false },
        },
        { freezeTableName: true },
      );
      const Alumni = this.sequelize.define(
        '_Alumni',
        {
          year: { type: DataTypes.INTEGER, primaryKey: true },
          num: { type: DataTypes.INTEGER, primaryKey: true },
          username: { type: DataTypes.STRING, allowNull: false, unique: true },
          dob: { type: DataTypes.DATEONLY, allowNull: false },
          dod: { type: DataTypes.DATEONLY, allowNull: true },
          city: { type: DataTypes.STRING, allowNull: false },
          ctrycod: {
            type: DataTypes.STRING,
            allowNull: false,
            references: { model: Country, key: 'code' },
          },
        },
        { freezeTableName: true },
      );

      await Country.sync({ force: true });
      const metacountry = await this.queryInterface.describeTable('_Country');
      expect(metacountry.code.primaryKey).to.eql(true);
      expect(metacountry.name.primaryKey).to.eql(false);

      await Alumni.sync({ force: true });
      const metalumni = await this.queryInterface.describeTable('_Alumni');
      expect(metalumni.year.primaryKey).to.eql(true);
      expect(metalumni.num.primaryKey).to.eql(true);
      expect(metalumni.username.primaryKey).to.eql(false);
      expect(metalumni.dob.primaryKey).to.eql(false);
      expect(metalumni.dod.primaryKey).to.eql(false);
      expect(metalumni.ctrycod.primaryKey).to.eql(false);
      expect(metalumni.city.primaryKey).to.eql(false);
    });

    it('should correctly return the columns when the table contains a dot in the name', async function () {
      const User = this.sequelize.define(
        'my.user',
        {
          name: DataTypes.STRING,
        },
        { freezeTableName: true },
      );

      await User.sync({ force: true });
      const metadata = await this.queryInterface.describeTable('my.user');

      expect(metadata).to.haveOwnProperty('name');
    });

    describe('default value parsing', () => {
      [
        'normal value',
        "with'quote",
        'with"quote',
        'with\\backslash',
        "with\\'backslash and quote",
        'with\\"backslash and quote',
        'with::double',
        "'surrounded by single quotes'",
        null,
        'null',
        'NULL',
        "Test('containing function call in string')",
        '99',
        '-99',
      ].forEach(defaultValue => {
        [DataTypes.STRING, DataTypes.TEXT, DataTypes.STRING(50)]
          // TEXT fields in MySQL or MariaDB cannot have a default value
          .filter(
            dataType =>
              dataType !== DataTypes.TEXT || (dialect !== 'mysql' && dialect !== 'mariadb'),
          )
          // .filter(dataType => dataType !== DataTypes.TEXT || dialect !== 'mariadb' || Support.sequelize.config.)
          .forEach(dataType => {
            it(`should return the right default value ${defaultValue} for fields of type ${dataType}`, async function () {
              await this.sequelize.queryInterface.createTable('with_string_default', {
                username: {
                  type: dataType,
                  defaultValue,
                },
              });

              const metadata = await this.queryInterface.describeTable('with_string_default');
              expect(metadata.username.defaultValue).to.eql(defaultValue);
            });
          });
      });

      [
        DataTypes.INTEGER,
        DataTypes.BIGINT,
        DataTypes.MEDIUMINT,
        DataTypes.TINYINT,
        DataTypes.SMALLINT,
        DataTypes.FLOAT,
        DataTypes.DOUBLE,
      ].forEach(dataType => {
        describe(`for fields of type ${dataType}`, () => {
          [0, 99, -99, 1, 0, null].forEach(defaultValue => {
            it(`should return ${defaultValue} as the default value`, async function () {
              await this.sequelize.queryInterface.createTable('with_number_default', {
                age: {
                  type: dataType,
                  defaultValue,
                },
              });

              const metadata = await this.queryInterface.describeTable('with_number_default');
              expect(metadata.age.defaultValue).to.eq(defaultValue);
            });
          });
        });
      });

      [DataTypes.FLOAT, DataTypes.DOUBLE].forEach(dataType => {
        describe(`for fields of type ${dataType}`, () => {
          [99.75, -99.75, 99, 1, 0, null].forEach(defaultValue => {
            it(`should return ${defaultValue} as the default value`, async function () {
              await this.sequelize.queryInterface.createTable('with_number_default', {
                age: {
                  type: dataType,
                  defaultValue,
                },
              });

              const metadata = await this.queryInterface.describeTable('with_number_default');
              expect(metadata.age.defaultValue).to.eq(defaultValue);
            });
          });
        });
      });

      if (Support.sequelize.dialect.supports.dataTypes.DECIMAL) {
        [DataTypes.DECIMAL(10, 2)].forEach(dataType => {
          describe(`for fields of type ${dataType}`, () => {
            ['99.75', '-99.75', '99.00', null].forEach(defaultValue => {
              it(`should return ${defaultValue} as the default value`, async function () {
                await this.sequelize.queryInterface.createTable('with_number_default', {
                  age: {
                    type: dataType,
                    defaultValue,
                  },
                });

                const metadata = await this.queryInterface.describeTable('with_number_default');
                expect(metadata.age.defaultValue).to.have.eq(defaultValue);
              });
            });
          });
        });
      }

      if (dialect === 'postgres') {
        describe('Boolean', () => {
          [true, false, null].forEach(defaultValue => {
            it(`should return the right default value ${defaultValue} for booleans`, async function () {
              await this.sequelize.queryInterface.createTable('users_booleans', {
                active: {
                  type: DataTypes.BOOLEAN,
                  defaultValue,
                  allowNull: true,
                },
              });

              const metadata = await this.queryInterface.describeTable('users_booleans');
              expect(metadata.active.defaultValue).to.eql(defaultValue);
            });
          });
        });
      }

      describe('Enums', () => {
        it('should return the right default value for enums', async function () {
          await this.sequelize.queryInterface.createTable('users_enum', {
            state: {
              type: DataTypes.ENUM('happy', 'sad', 'meh'),
              defaultValue: 'happy',
            },
          });

          const metadata = await this.queryInterface.describeTable('users_enum');
          expect(metadata.state.defaultValue).to.eql('happy');
        });
      });

      if (Support.sequelize.dialect.supports.dataTypes.ARRAY) {
        describe('ARRAY', () => {
          it('should return the right default value for arrays of strings', async function () {
            await this.sequelize.queryInterface.createTable('users_array', {
              tags: {
                type: DataTypes.ARRAY(DataTypes.STRING),
                defaultValue: ['happy', 'sad', 'meh'],
              },
            });

            const metadata = await this.queryInterface.describeTable('users_array');
            expect(metadata.tags.defaultValue).to.eql(
              literal(
                "ARRAY['happy'::character varying(255), 'sad'::character varying(255), 'meh'::character varying(255)]",
              ),
            );
          });

          it('should return the right default value for arrays of integers', async function () {
            await this.sequelize.queryInterface.createTable('users_array', {
              tags: {
                type: DataTypes.ARRAY(DataTypes.INTEGER),
                defaultValue: [1, 2, 3],
              },
            });

            const metadata = await this.queryInterface.describeTable('users_array');
            expect(metadata.tags.defaultValue).to.eql(literal('ARRAY[1, 2, 3]'));
          });
        });
      }

      [DataTypes.JSON, DataTypes.JSONB].forEach(dataType => {
        // MariaDB, MySQL does not support default values in JSON fields
        // SQLite handles JSON fields as TEXT
        if (
          Support.sequelize.dialect.supports.dataTypes[dataType.name] &&
          !['mariadb', 'mysql', 'sqlite'].includes(dialect)
        ) {
          describe(`for fields of type ${dataType.name}`, () => {
            it('should return the right default value for a JSON object', async function () {
              await this.sequelize.queryInterface.createTable('user_with_json', {
                settings: {
                  type: dataType,
                  defaultValue: { foo: "bar's" },
                },
              });

              const metadata = await this.queryInterface.describeTable('user_with_json');
              expect(metadata.settings.defaultValue).to.eql({ foo: "bar's" });
            });
          });
        }
      });

      it('should return the right default value for a function call', async function () {
        const now =
          dialect === 'sqlite'
            ? 'CURRENT_TIMESTAMP'
            : dialect === 'mssql'
              ? 'getdate()'
              : dialect === 'mariadb'
                ? 'current_timestamp()'
                : 'now()';

        await this.sequelize.queryInterface.createTable(
          'user_with_date',
          {
            date: {
              type: DataTypes.DATE,
              defaultValue: literal(now),
            },
          },
          { freezeTableName: true },
        );

        const metadata = await this.queryInterface.describeTable('user_with_date');
        expect(metadata.date.defaultValue).to.eql(literal(now));
      });

      it('should return the right default value for autoincrement', async function () {
        await this.sequelize.queryInterface.createTable('user_autoincrement', {
          id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
          },
        });

        const metadata = await this.queryInterface.describeTable('user_autoincrement');

        Support.expectPerDialect(() => metadata.id.defaultValue, {
          postgres: literal(`nextval('user_autoincrement_id_seq'::regclass)`),
          'mysql mariadb': undefined,
          sqlite: undefined,
        });
      });

      if (Support.sequelize.dialect.supports.dataTypes.BOOLEAN) {
        [true, false, null].forEach(defaultValue => {
          it(`should return the right default value ${defaultValue} for booleans`, async function () {
            await this.sequelize.queryInterface.createTable('users_booleans', {
              active: {
                type: DataTypes.BOOLEAN,
                defaultValue,
                allowNull: false,
              },
            });

            const metadata = await this.queryInterface.describeTable('users_booleans');
            expect(metadata.active.defaultValue).to.eql({
              parsed: defaultValue,
              raw: defaultValue,
            });
          });
        });
      }
    });
  });
});
