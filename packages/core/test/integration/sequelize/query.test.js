'use strict';

const { expect } = require('chai');
const {
  DatabaseError,
  DataTypes,
  ForeignKeyConstraintError,
  Sequelize,
  sql,
  UniqueConstraintError,
} = require('@sequelize/core');
const sinon = require('sinon');
const dayjs = require('dayjs');
const {
  allowDeprecationsInSuite,
  beforeEach2,
  createSequelizeInstance,
  createSingleTestSequelizeInstance,
  destroySequelizeAfterTest,
  getTestDialect,
  getTestDialectTeaser,
  sequelize,
} = require('../support');

const dialectName = getTestDialect();
const queryGenerator = sequelize.queryGenerator;

const qq = str => {
  if (['postgres', 'mssql', 'db2', 'ibmi'].includes(dialectName)) {
    return `"${str}"`;
  }

  if (['mysql', 'mariadb', 'sqlite3'].includes(dialectName)) {
    return `\`${str}\``;
  }

  return str;
};

describe(getTestDialectTeaser('Sequelize'), () => {
  allowDeprecationsInSuite(['SEQUELIZE0023']);

  describe('query', () => {
    afterEach(() => {
      console.log.restore && console.log.restore();
    });

    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          unique: true,
        },
        emailAddress: {
          type: DataTypes.STRING,
          field: 'email_address',
        },
      });

      this.insertQuery = `INSERT INTO ${qq(this.User.tableName)} (username, email_address, ${qq(
        'createdAt',
      )}, ${qq(
        'updatedAt',
      )}) VALUES ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
      if (['db2', 'ibmi'].includes(dialectName)) {
        this.insertQuery = `INSERT INTO ${qq(this.User.tableName)}
          ("username", "email_address", ${qq('createdAt')}, ${qq('updatedAt')}) VALUES ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
      }

      await this.User.sync({ force: true });
    });

    it('executes a query the internal way', async function () {
      await this.sequelize.query(this.insertQuery, { raw: true });
    });

    it('executes a query if only the sql is passed', async function () {
      await this.sequelize.query(this.insertQuery);
    });

    describe('QueryTypes', () => {
      it('RAW', async function () {
        await this.sequelize.query(this.insertQuery, {
          type: Sequelize.QueryTypes.RAW,
        });

        const [rows, count] = await this.sequelize.query(
          `SELECT * FROM ${qq(this.User.tableName)};`,
          {
            type: Sequelize.QueryTypes.RAW,
          },
        );

        expect(rows).to.be.an.instanceof(Array);
        expect(count).to.be.ok;
      });
    });

    describe('retry', () => {
      it('properly bind parameters on extra retries', async function () {
        const payload = {
          username: 'test',
          createdAt: '2010-10-10 00:00:00',
          updatedAt: '2010-10-10 00:00:00',
        };

        const spy = sinon.spy();

        await this.User.create(payload);

        await expect(
          this.sequelize.query(
            `
          INSERT INTO ${qq(this.User.tableName)} (${qq('username')},${qq('createdAt')},${qq('updatedAt')}) VALUES ($username,$createdAt,$updatedAt);
        `,
            {
              bind: payload,
              logging: spy,
              retry: {
                max: 3,
                match: [/Validation/],
              },
            },
          ),
        ).to.be.rejectedWith(Sequelize.UniqueConstraintError);
        expect(spy.callCount).to.eql(['db2', 'ibmi'].includes(dialectName) ? 1 : 3);
      });
    });

    describe('logging', () => {
      it('executes a query with global benchmarking option and custom logger', async () => {
        const logger = sinon.spy();
        const sequelize = createSingleTestSequelizeInstance({
          logging: logger,
          benchmark: true,
        });

        await sequelize.query(`select 1${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''};`);
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \((\d*|default)\): select 1/);
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });

      it('executes a query with benchmarking option and custom logger', async function () {
        const logger = sinon.spy();

        await this.sequelize.query(
          `select 1${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''};`,
          {
            logging: logger,
            benchmark: true,
          },
        );

        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \(\d*|default\): select 1;/);
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });

      it('executes a query with queryLabel option and custom logger', async () => {
        const logger = sinon.spy();
        const sequelize = createSingleTestSequelizeInstance({
          logging: logger,
        });

        await sequelize.query(
          `select 1${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''};`,
          {
            queryLabel: 'tricky select',
          },
        );
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(
          /^tricky select[\n]Executing \((\d*|default)\): select 1/,
        );
      });

      it('executes a query with empty string, queryLabel option and custom logger', async () => {
        const logger = sinon.spy();
        const sequelize = createSingleTestSequelizeInstance({
          logging: logger,
        });

        await sequelize.query(
          `select 1${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''};`,
          {
            queryLabel: '',
          },
        );
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/^Executing \((\d*|default)\): select 1/);
      });

      it('executes a query with benchmarking option, queryLabel option and custom logger', async () => {
        const logger = sinon.spy();
        const sequelize = createSingleTestSequelizeInstance({
          logging: logger,
          benchmark: true,
        });

        await sequelize.query(
          `select 1${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''};`,
          {
            queryLabel: 'tricky select',
          },
        );
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(
          /^tricky select[\n]Executed \((\d*|default)\): select 1/,
        );
      });

      describe('with logQueryParameters', () => {
        const vars = beforeEach2(async () => {
          const sequelize = createSequelizeInstance({
            benchmark: true,
            logQueryParameters: true,
          });

          const User = sequelize.define(
            'User',
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
              },
              username: {
                type: DataTypes.STRING,
              },
              emailAddress: {
                type: DataTypes.STRING,
              },
            },
            {
              timestamps: false,
            },
          );

          await User.sync({ force: true });

          return { sequelize, User };
        });

        afterEach(() => {
          return vars.sequelize.close();
        });

        it('add parameters in log sql', async () => {
          let createSql;
          let updateSql;

          const user = await vars.User.create(
            {
              username: 'john',
              emailAddress: 'john@gmail.com',
            },
            {
              logging: s => {
                createSql = s;
              },
            },
          );

          user.username = 'li';

          await user.save({
            logging: s => {
              updateSql = s;
            },
          });

          if (
            dialectName === 'db2' ||
            dialectName === 'postgres' ||
            dialectName === 'mariadb' ||
            dialectName === 'mysql'
          ) {
            // these dialects use positional bind parameters
            expect(createSql.endsWith(` with parameters [ 'john', 'john@gmail.com' ]`)).to.eq(
              true,
              'bind parameters incorrectly logged for INSERT query',
            );
            expect(updateSql.endsWith(` with parameters [ 'li', 1 ]`)).to.eq(
              true,
              'bind parameters incorrectly logged for UPDATE query',
            );
          } else {
            // these dialects use named bind parameters
            expect(
              createSql.endsWith(
                ` with parameters { sequelize_1: 'john', sequelize_2: 'john@gmail.com' }`,
              ),
            ).to.eq(true, 'bind parameters incorrectly logged for INSERT query');
            expect(
              updateSql.endsWith(` with parameters { sequelize_1: 'li', sequelize_2: 1 }`),
            ).to.eq(true, 'bind parameters incorrectly logged for UPDATE query');
          }
        });

        it('add parameters in log sql when use bind value', async () => {
          let logSql;
          let typeCast = dialectName === 'postgres' ? '::text' : '';
          if (['db2'].includes(dialectName)) {
            typeCast = '::VARCHAR';
          }

          await vars.sequelize.query(
            `select $1${typeCast} as foo, $2${typeCast} as bar${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            {
              bind: ['foo', 'bar'],
              logging: s => {
                logSql = s;
              },
            },
          );

          expect(logSql.endsWith(` with parameters [ 'foo', 'bar' ]`)).to.eq(
            true,
            'bind parameters incorrectly logged.',
          );
        });
      });
    });

    it('executes select queries correctly', async function () {
      await this.sequelize.query(this.insertQuery);
      const [users] = await this.sequelize.query(`select * from ${qq(this.User.tableName)}`);
      expect(
        users.map(u => {
          return u.username;
        }),
      ).to.include('john');
    });

    it('executes select queries correctly when quoteIdentifiers is false', async function () {
      const sequelize = createSequelizeInstance({
        quoteIdentifiers: false,
      });

      destroySequelizeAfterTest(sequelize);

      await sequelize.query(this.insertQuery);
      const [users] = await sequelize.query(`select * from ${qq(this.User.tableName)}`);
      expect(
        users.map(u => {
          return u.username;
        }),
      ).to.include('john');
    });

    it('executes select query with dot notation results', async function () {
      await this.sequelize.query(`DELETE FROM ${qq(this.User.tableName)}`);
      await this.sequelize.query(this.insertQuery);
      const [users] = await this.sequelize.query(
        `select ${qq('username')} as ${qq('user.username')} from ${qq(this.User.tableName)}`,
      );
      expect(users).to.deep.equal([{ 'user.username': 'john' }]);
    });

    it('executes select query with dot notation results and nest it', async function () {
      await this.sequelize.query(`DELETE FROM ${qq(this.User.tableName)}`);
      await this.sequelize.query(this.insertQuery);
      const users = await this.sequelize.query(
        `select ${qq('username')} as ${qq('user.username')} from ${qq(this.User.tableName)}`,
        { raw: true, nest: true },
      );
      expect(
        users.map(u => {
          return u.user;
        }),
      ).to.deep.equal([{ username: 'john' }]);
    });

    if (dialectName === 'mysql') {
      it('executes stored procedures', async function () {
        await this.sequelize.query(this.insertQuery);
        await this.sequelize.query('DROP PROCEDURE IF EXISTS foo');

        await this.sequelize.query(`CREATE PROCEDURE foo()\nSELECT * FROM ${this.User.tableName};`);

        const users = await this.sequelize.query('CALL foo()');
        expect(
          users.map(u => {
            return u.username;
          }),
        ).to.include('john');
      });
    } else if (dialectName === 'db2') {
      it('executes stored procedures', async function () {
        const { sequelize } = this;

        await sequelize.query(this.insertQuery);

        try {
          await sequelize.query('DROP PROCEDURE foo');
        } catch (error) {
          // DB2 does not support DROP PROCEDURE IF EXISTS
          // -204 means "FOO" does not exist
          // https://www.ibm.com/docs/en/db2-for-zos/11?topic=sec-204
          if (error.cause.sqlcode !== -204) {
            throw error;
          }
        }

        await sequelize.query(
          `CREATE PROCEDURE foo() DYNAMIC RESULT SETS 1 LANGUAGE SQL BEGIN DECLARE cr1 CURSOR WITH RETURN FOR SELECT * FROM ${qq(this.User.tableName)}; OPEN cr1; END`,
        );

        const users = await sequelize.query('CALL foo()');
        expect(users.map(u => u.username)).to.include('john');
      });
    }

    it('uses the passed model', async function () {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        model: this.User,
      });

      expect(users[0]).to.be.instanceof(this.User);
    });

    it('maps the field names to attributes based on the passed model', async function () {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        model: this.User,
        mapToModel: true,
      });

      expect(users[0].emailAddress).to.equal('john@gmail.com');
    });

    it('arbitrarily map the field names', async function () {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        type: 'SELECT',
        fieldMap: { username: 'userName', email_address: 'email' },
      });

      expect(users[0].userName).to.equal('john');
      expect(users[0].email).to.equal('john@gmail.com');
    });

    it('keeps field names that are mapped to the same name', async function () {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        type: 'SELECT',
        fieldMap: { username: 'username', email_address: 'email' },
      });

      expect(users[0].username).to.equal('john');
      expect(users[0].email).to.equal('john@gmail.com');
    });

    // Only run stacktrace tests on Node 12+, since only Node 12+ supports
    // async stacktraces
    const nodeVersionMatch = process.version.match(/^v(\d+)/);
    let nodeMajorVersion = 0;
    if (nodeVersionMatch && nodeVersionMatch[1]) {
      nodeMajorVersion = Number.parseInt(nodeVersionMatch[1], 10);
    }

    if (nodeMajorVersion >= 12) {
      describe('stacktraces', () => {
        beforeEach(async function () {
          this.UserVisit = this.sequelize.define(
            'UserVisit',
            {
              userId: {
                type: DataTypes.STRING,
                field: 'user_id',
              },
              visitedAt: {
                type: DataTypes.DATE,
                field: 'visited_at',
              },
            },
            {
              indexes: [{ name: 'user_id', fields: ['user_id'] }],
            },
          );

          this.User.hasMany(this.UserVisit, { foreignKey: 'user_id' });

          await this.UserVisit.sync({ force: true });
        });

        it('emits raw errors if requested', async function () {
          const sql = 'SELECT 1 FROM NotFoundTable';

          await expect(
            this.sequelize.query(sql, { rawErrors: false }),
          ).to.eventually.be.rejectedWith(DatabaseError);

          await expect(
            this.sequelize.query(sql, { rawErrors: true }),
          ).to.eventually.be.rejected.and.not.be.an.instanceOf(DatabaseError);
        });

        it('emits full stacktraces for generic database error', async function () {
          let error = null;
          try {
            await this.sequelize.query(
              `select * from ${qq(this.User.tableName)} where ${qq('unknown_column')} = 1`,
            );
          } catch (error_) {
            error = error_;
          }

          expect(error).to.be.instanceOf(DatabaseError);
          expect(error.stack).to.contain('query.test');
        });

        it('emits full stacktraces for unique constraint error', async function () {
          let query;
          if (['db2', 'ibmi'].includes(dialectName)) {
            query = `INSERT INTO ${qq(this.User.tableName)} ("username", "email_address", ${qq(
              'createdAt',
            )}, ${qq(
              'updatedAt',
            )}) VALUES ('duplicate', 'duplicate@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
          } else {
            query = `INSERT INTO ${qq(this.User.tableName)} (username, email_address, ${qq(
              'createdAt',
            )}, ${qq(
              'updatedAt',
            )}) VALUES ('duplicate', 'duplicate@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
          }

          let error = null;
          try {
            // Insert 1 row
            await this.sequelize.query(query);
            // Try inserting a duplicate row
            await this.sequelize.query(query);
          } catch (error_) {
            error = error_;
          }

          expect(error).to.be.instanceOf(UniqueConstraintError);
          expect(error.stack).to.contain('query.test');
        });

        it('emits full stacktraces for constraint validation error', async function () {
          let error = null;
          try {
            let query;
            if (['db2', 'ibmi'].includes(dialectName)) {
              query = `INSERT INTO ${qq(this.UserVisit.tableName)} ("user_id", "visited_at", ${qq(
                'createdAt',
              )}, ${qq(
                'updatedAt',
              )}) VALUES (123456789, '2012-01-01 10:10:10', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
            } else {
              query = `INSERT INTO ${qq(this.UserVisit.tableName)} (user_id, visited_at, ${qq(
                'createdAt',
              )}, ${qq(
                'updatedAt',
              )}) VALUES (123456789, '2012-01-01 10:10:10', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;
            }

            await this.sequelize.query(query);
          } catch (error_) {
            error = error_;
          }

          expect(error).to.be.instanceOf(ForeignKeyConstraintError);
          expect(error.stack).to.contain('query.test');
        });
      });
    }

    describe('rejections', () => {
      it('reject if the query is not a string', async function () {
        // this is a legacy, removed signature
        await this.sequelize
          .query(
            { query: 'select ? as foo, ? as bar', values: [1, 2] },
            { raw: true, replacements: [1, 2] },
          )
          .should.be.rejectedWith(
            Error,
            '"sql" cannot be an object. Pass a string instead, and pass bind and replacement parameters through the "options" parameter',
          );
      });

      it('reject when key is missing in the passed object', async function () {
        await this.sequelize
          .query('select :one as foo, :two as bar, :three as baz', {
            raw: true,
            replacements: { one: 1, two: 2 },
          })
          .should.be.rejectedWith(
            Error,
            /Named replacement ":\w+" has no entry in the replacement map\./g,
          );
      });

      it('rejects if replacements is a number', async function () {
        await this.sequelize
          .query('select :one as foo, :two as bar', { raw: true, replacements: 2 })
          .should.be.rejectedWith(
            Error,
            '"replacements" must be an array or a plain object, but received 2 instead.',
          );
      });

      it('rejects if a replacement is missing', async function () {
        await this.sequelize
          .query('select :one as foo, :two as bar', { raw: true, replacements: {} })
          .should.be.rejectedWith(
            Error,
            /Named replacement ":\w+" has no entry in the replacement map\./g,
          );
      });

      it('rejects if replacements is a string', async function () {
        await this.sequelize
          .query('select :one as foo, :two as bar', { raw: true, replacements: 'foobar' })
          .should.be.rejectedWith(
            Error,
            '"replacements" must be an array or a plain object, but received "foobar" instead.',
          );
      });

      it('reject if replacements is not a plain object', async function () {
        await this.sequelize
          .query('select :one as foo, :two as bar', {
            raw: true,
            replacements: new URL('http://example.com'),
          })
          .should.be.rejectedWith(
            Error,
            '"replacements" must be an array or a plain object, but received "http://example.com/" instead.',
          );
      });

      it('reject when binds passed with object and numeric $1 is also present', async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';

        await this.sequelize
          .query(`select $one${typeCast} as foo, $two${typeCast} as bar, $1 as baz`, {
            raw: true,
            bind: { one: 1, two: 2 },
          })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('rejects when binds passed as array and a named parameter is also present', async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';

        await this.sequelize
          .query(`select $1${typeCast} as foo, $2${typeCast} as bar, $foo as baz`, {
            raw: true,
            bind: [1, 2],
          })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('reject when bind key is $0 and bind is an array', async function () {
        await this.sequelize
          .query('select $1 as foo, $0 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('reject when bind key is $01 and bind is an array', async function () {
        await this.sequelize
          .query('select $1 as foo, $01 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('reject when bind key is missing in the passed array', async function () {
        await this.sequelize
          .query('select $1 as foo, $2 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('reject when bind key is missing in the passed object', async function () {
        await this.sequelize
          .query('select $one as foo, $two as bar, $three as baz', {
            raw: true,
            bind: { one: 1, two: 2 },
          })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('rejects if options.bind is a number', async function () {
        await this.sequelize
          .query('select $one as foo, $two as bar', { raw: true, bind: 2 })
          .should.be.rejectedWith(
            Error,
            'options.bind must be either a plain object (for named parameters) or an array (for numeric parameters)',
          );
      });

      it('rejects if a bind parameter is not present in options.bind', async function () {
        await this.sequelize
          .query('select $one as foo, $two as bar', { raw: true, bind: {} })
          .should.be.rejectedWith(
            Error,
            /Query includes bind parameter "\$\w+", but no value has been provided for that bind parameter\./g,
          );
      });

      it('rejects if options.bind is a string', async function () {
        await this.sequelize
          .query('select $one as foo, $two as bar', { raw: true, bind: 'foobar' })
          .should.be.rejectedWith(
            Error,
            'options.bind must be either a plain object (for named parameters) or an array (for numeric parameters)',
          );
      });

      it('rejects if options.bind is a non-pojo object', async function () {
        await this.sequelize
          .query('select $one as foo, $two as bar', { raw: true, bind: new Date() })
          .should.be.rejectedWith(
            Error,
            'options.bind must be either a plain object (for named parameters) or an array (for numeric parameters)',
          );
      });
    });

    // dialects in which the following values will be returned as bigints instead of ints
    const isBigInt = dialectName === 'mysql';
    it('dot separated attributes when doing a raw query without nest', async function () {
      const sql = `select 1 as ${queryGenerator.quoteIdentifier('foo.bar.baz')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`;

      const results = await this.sequelize.query(sql, { raw: true, nest: false });
      expect(results[0]).to.deep.equal([{ 'foo.bar.baz': isBigInt ? '1' : 1 }]);
    });

    it('destructs dot separated attributes when doing a raw query using nest', async function () {
      const sql = `select 1 as ${queryGenerator.quoteIdentifier('foo.bar.baz')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`;

      const result = await this.sequelize.query(sql, { raw: true, nest: true });
      expect(result).to.deep.equal([{ foo: { bar: { baz: isBigInt ? '1' : 1 } } }]);
    });

    it('replaces token with the passed array', async function () {
      const expected = [{ foo: isBigInt ? '1' : 1, bar: isBigInt ? '2' : 2 }];
      const result = await this.sequelize.query(
        `select ? as ${queryGenerator.quoteIdentifier('foo')}, ? as ${queryGenerator.quoteIdentifier('bar')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
        { type: this.sequelize.QueryTypes.SELECT, replacements: [1, 2] },
      );
      expect(result).to.deep.equal(expected);
    });

    it('replaces named parameters with the passed object', async function () {
      const expected = [{ foo: isBigInt ? '1' : 1, bar: isBigInt ? '2' : 2 }];
      await expect(
        this.sequelize
          .query(
            `select :one as ${queryGenerator.quoteIdentifier('foo')}, :two as ${queryGenerator.quoteIdentifier('bar')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            { raw: true, replacements: { one: 1, two: 2 } },
          )
          .then(obj => obj[0]),
      ).to.eventually.deep.equal(expected);
    });

    it('replaces named parameters with the passed object and ignore those which does not qualify', async function () {
      const expected = [{ foo: isBigInt ? '1' : 1, bar: isBigInt ? '2' : 2, baz: '00:00' }];
      await expect(
        this.sequelize
          .query(
            `select :one as ${queryGenerator.quoteIdentifier('foo')}, :two as ${queryGenerator.quoteIdentifier('bar')}, '00:00' as ${queryGenerator.quoteIdentifier('baz')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            { raw: true, replacements: { one: 1, two: 2 } },
          )
          .then(obj => obj[0]),
      ).to.eventually.deep.equal(expected);
    });

    it('replaces named parameters with the passed object using the same key twice', async function () {
      const expected = [
        { foo: isBigInt ? '1' : 1, bar: isBigInt ? '2' : 2, baz: isBigInt ? '1' : 1 },
      ];
      await expect(
        this.sequelize
          .query(
            `select :one as ${queryGenerator.quoteIdentifier('foo')}, :two as ${queryGenerator.quoteIdentifier('bar')}, :one as ${queryGenerator.quoteIdentifier('baz')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            { raw: true, replacements: { one: 1, two: 2 } },
          )
          .then(obj => obj[0]),
      ).to.eventually.deep.equal(expected);
    });

    it('replaces named parameters with the passed object having a null property', async function () {
      const expected = [{ foo: isBigInt ? '1' : 1, bar: null }];
      await expect(
        this.sequelize
          .query(
            `select :one as ${queryGenerator.quoteIdentifier('foo')}, :two as ${queryGenerator.quoteIdentifier('bar')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            { raw: true, replacements: { one: 1, two: null } },
          )
          .then(obj => obj[0]),
      ).to.eventually.deep.equal(expected);
    });

    // IBM i cannot bind parameter markers for selecting values like in theses
    // tests
    if (dialectName !== 'ibmi') {
      it('binds token with the passed array', async function () {
        const expected = [{ foo: 1, bar: 2 }];

        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        let logSql;
        const result = await this.sequelize.query(
          `select $1${typeCast} as ${queryGenerator.quoteIdentifier('foo')}, $2${typeCast} as ${queryGenerator.quoteIdentifier('bar')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          {
            type: this.sequelize.QueryTypes.SELECT,
            bind: [1, 2],
            logging(s) {
              logSql = s;
            },
          },
        );
        expect(result).to.deep.equal(expected);
        if (['postgres', 'sqlite3'].includes(dialectName)) {
          expect(logSql).to.include('$1');
        }
      });

      it('binds named parameters with the passed object', async function () {
        const expected = [{ foo: 1, bar: 2 }];

        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        let logSql;
        const result = await this.sequelize.query(
          `select $one${typeCast} as ${queryGenerator.quoteIdentifier('foo')}, $two${typeCast} as ${queryGenerator.quoteIdentifier('bar')}${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          {
            raw: true,
            bind: { one: 1, two: 2 },
            logging(s) {
              logSql = s;
            },
          },
        );
        expect(result[0]).to.deep.equal(expected);
        if (dialectName === 'postgres') {
          expect(logSql).to.include('$1');
        }

        if (dialectName === 'sqlite3') {
          expect(logSql).to.include('$one');
        }
      });

      if (dialectName !== 'db2') {
        it('binds named parameters with the passed object using the same key twice', async function () {
          const typeCast = dialectName === 'postgres' ? '::int' : '';
          let logSql;
          const result = await this.sequelize.query(
            `select $one${typeCast} as foo, $two${typeCast} as bar, $one${typeCast} as baz${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
            {
              raw: true,
              bind: { one: 1, two: 2 },
              logging(s) {
                logSql = s;
              },
            },
          );
          if (dialectName === 'ibmi') {
            expect(result[0]).to.deep.equal([{ FOO: 1, BAR: 2, BAZ: 1 }]);
          } else {
            expect(result[0]).to.deep.equal([{ foo: 1, bar: 2, baz: 1 }]);
          }

          if (dialectName === 'postgres') {
            expect(logSql).to.include('$1');
            expect(logSql).to.include('$2');
            expect(logSql).to.not.include('$3');
          }
        });
      }

      it('binds named parameters with the passed object having a null property', async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        const result = await this.sequelize.query(
          `select $one${typeCast} as foo, $two${typeCast} as bar${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          { raw: true, bind: { one: 1, two: null } },
        );
        const expected = ['db2', 'ibmi'].includes(dialectName)
          ? [{ FOO: 1, BAR: null }]
          : [{ foo: 1, bar: null }];
        expect(result[0]).to.deep.equal(expected);
      });

      // this was a legacy band aid that has since been removed, because the underlying issue (transforming bind params in strings) has been fixed.
      it('does not transform $$ in strings (positional)', async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        let logSql;
        const result = await this.sequelize.query(
          `select $1${typeCast} as foo, '$$ / $$1' as bar${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          {
            raw: true,
            bind: [1],
            logging(s) {
              logSql = s;
            },
          },
        );
        const expected = ['db2', 'ibmi'].includes(dialectName)
          ? [{ FOO: 1, BAR: '$$ / $$1' }]
          : [{ foo: 1, bar: '$$ / $$1' }];
        expect(result[0]).to.deep.equal(expected);
        if (['postgres', 'sqlite3', 'db2', 'ibmi'].includes(dialectName)) {
          expect(logSql).to.include('$1');
        }
      });

      // this was a legacy band aid that has since been removed, because the underlying issue (transforming bind params in strings) has been fixed.
      it('does not transform $$ in strings (named)', async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        const result = await this.sequelize.query(
          `select $one${typeCast} as foo, '$$ / $$one' as bar${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          { raw: true, bind: { one: 1 } },
        );
        const expected = ['db2', 'ibmi'].includes(dialectName)
          ? [{ FOO: 1, BAR: '$$ / $$one' }]
          : [{ foo: 1, bar: '$$ / $$one' }];
        expect(result[0]).to.deep.equal(expected);
      });

      it(`does not treat a $ as a bind param if it's in the middle of an identifier`, async function () {
        const typeCast = ['postgres', 'db2'].includes(dialectName) ? '::int' : '';
        const result = await this.sequelize.query(
          `select $one${typeCast} as foo$bar${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
          { raw: true, bind: { one: 1 } },
        );
        const expected = ['db2', 'ibmi'].includes(dialectName)
          ? [{ FOO$BAR: 1 }]
          : [{ foo$bar: 1 }];
        expect(result[0]).to.deep.equal(expected);
      });
    }

    if (['postgres', 'sqlite3', 'mssql'].includes(dialectName)) {
      it('does not improperly escape arrays of strings bound to named parameters', async function () {
        const result = await this.sequelize.query('select :stringArray as foo', {
          raw: true,
          replacements: { stringArray: sql.list(['"string"']) },
        });
        expect(result[0]).to.deep.equal([{ foo: '"string"' }]);
      });
    }

    it('handles AS in conjunction with functions just fine', async function () {
      let datetime = dialectName === 'sqlite3' ? "date('now')" : 'NOW()';
      if (dialectName === 'mssql') {
        datetime = 'GETDATE()';
      }

      const [result] = await this.sequelize.query(
        `SELECT ${datetime} AS t${dialectName === 'ibmi' ? ' FROM SYSIBM.SYSDUMMY1' : ''}`,
      );
      expect(dayjs(result[0].t).isValid()).to.be.true;
    });

    if (getTestDialect() === 'postgres') {
      it('replaces named parameters with the passed object and ignores casts', async function () {
        await expect(
          this.sequelize
            .query("select :one as foo, :two as bar, '1000'::integer as baz", {
              raw: true,
              replacements: { one: 1, two: 2 },
            })
            .then(obj => obj[0]),
        ).to.eventually.deep.equal([{ foo: 1, bar: 2, baz: 1000 }]);
      });

      it('supports WITH queries', async function () {
        await expect(
          this.sequelize
            .query(
              'WITH RECURSIVE t(n) AS ( VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n < 100) SELECT sum(n) FROM t',
            )
            .then(obj => obj[0]),
        ).to.eventually.deep.equal([{ sum: '5050' }]);
      });
    }
  });
});
