'use strict';

const { expect } = require('chai');
const Support = require('../support');
const Sequelize = Support.Sequelize;
const DataTypes = Support.Sequelize.DataTypes;
const dialect = Support.getTestDialect();
const sinon = require('sinon');
const moment = require('moment');

const qq = str => {
  if (dialect === 'postgres' || dialect === 'mssql') {
    return `"${str}"`;
  }
  if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'sqlite') {
    return `\`${str}\``;
  }
  return str;
};

describe(Support.getTestDialectTeaser('Sequelize'), () => {
  describe('query', () => {
    afterEach(function() {
      this.sequelize.options.quoteIdentifiers = true;
      console.log.restore && console.log.restore();
    });

    beforeEach(async function() {
      this.User = this.sequelize.define('User', {
        username: {
          type: Sequelize.STRING,
          unique: true
        },
        emailAddress: {
          type: Sequelize.STRING,
          field: 'email_address'
        }
      });

      this.insertQuery = `INSERT INTO ${qq(this.User.tableName)} (username, email_address, ${
        qq('createdAt')  }, ${qq('updatedAt')
      }) VALUES ('john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10')`;

      await this.User.sync({ force: true });
    });

    it('executes a query the internal way', async function() {
      await this.sequelize.query(this.insertQuery, { raw: true });
    });

    it('executes a query if only the sql is passed', async function() {
      await this.sequelize.query(this.insertQuery);
    });

    it('executes a query if a placeholder value is an array', async function() {
      await this.sequelize.query(`INSERT INTO ${qq(this.User.tableName)} (username, email_address, ` +
        `${qq('createdAt')}, ${qq('updatedAt')}) VALUES ?;`, {
        replacements: [[
          ['john', 'john@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10'],
          ['michael', 'michael@gmail.com', '2012-01-01 10:10:10', '2012-01-01 10:10:10']
        ]]
      });

      const rows = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        type: this.sequelize.QueryTypes.SELECT
      });

      expect(rows).to.be.lengthOf(2);
      expect(rows[0].username).to.be.equal('john');
      expect(rows[1].username).to.be.equal('michael');
    });

    describe('QueryTypes', () => {
      it('RAW', async function() {
        await this.sequelize.query(this.insertQuery, {
          type: Sequelize.QueryTypes.RAW
        });

        const [rows, count] = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
          type: Sequelize.QueryTypes.RAW
        });

        expect(rows).to.be.an.instanceof(Array);
        expect(count).to.be.ok;
      });
    });

    describe('retry',  () => {
      it('properly bind parameters on extra retries', async function() {
        const payload = {
          username: 'test',
          createdAt: '2010-10-10 00:00:00',
          updatedAt: '2010-10-10 00:00:00'
        };

        const spy = sinon.spy();

        await this.User.create(payload);

        await expect(this.sequelize.query(`
          INSERT INTO ${qq(this.User.tableName)} (username,${qq('createdAt')},${qq('updatedAt')}) VALUES ($username,$createdAt,$updatedAt);
        `, {
          bind: payload,
          logging: spy,
          retry: {
            max: 3,
            match: [
              /Validation/
            ]
          }
        })).to.be.rejectedWith(Sequelize.UniqueConstraintError);

        expect(spy.callCount).to.eql(3);
      });
    });

    describe('logging', () => {
      it('executes a query with global benchmarking option and custom logger', async () => {
        const logger = sinon.spy();
        const sequelize = Support.createSequelizeInstance({
          logging: logger,
          benchmark: true
        });

        await sequelize.query('select 1;');
        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \((\d*|default)\): select 1/);
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });

      it('executes a query with benchmarking option and custom logger', async function() {
        const logger = sinon.spy();

        await this.sequelize.query('select 1;', {
          logging: logger,
          benchmark: true
        });

        expect(logger.calledOnce).to.be.true;
        expect(logger.args[0][0]).to.be.match(/Executed \(\d*|default\): select 1;/);
        expect(typeof logger.args[0][1] === 'number').to.be.true;
      });

      describe('with logQueryParameters', () => {
        beforeEach(async function() {
          this.sequelize = Support.createSequelizeInstance({
            benchmark: true,
            logQueryParameters: true
          });
          this.User = this.sequelize.define('User', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            username: {
              type: DataTypes.STRING
            },
            emailAddress: {
              type: DataTypes.STRING
            }
          }, {
            timestamps: false
          });

          await this.User.sync({ force: true });
        });

        it('add parameters in log sql', async function() {
          let createSql, updateSql;

          const user = await this.User.create({
            username: 'john',
            emailAddress: 'john@gmail.com'
          }, {
            logging: s =>{
              createSql = s;
            }
          });

          user.username = 'li';

          await user.save({
            logging: s =>{
              updateSql = s;
            }
          });

          expect(createSql).to.match(/; ("john", "john@gmail.com"|{"(\$1|0)":"john","(\$2|1)":"john@gmail.com"})/);
          expect(updateSql).to.match(/; ("li", 1|{"(\$1|0)":"li","(\$2|1)":1})/);
        });

        it('add parameters in log sql when use bind value', async function() {
          let logSql;
          const typeCast = dialect === 'postgres' ? '::text' : '';
          await this.sequelize.query(`select $1${typeCast} as foo, $2${typeCast} as bar`, { bind: ['foo', 'bar'], logging: s=>logSql = s });
          expect(logSql).to.match(/; ("foo", "bar"|{"(\$1|0)":"foo","(\$2|1)":"bar"})/);
        });
      });
    });

    it('executes select queries correctly', async function() {
      await this.sequelize.query(this.insertQuery);
      const [users] = await this.sequelize.query(`select * from ${qq(this.User.tableName)}`);
      expect(users.map(u => { return u.username; })).to.include('john');
    });

    it('executes select queries correctly when quoteIdentifiers is false', async function() {
      const seq = Object.create(this.sequelize);

      seq.options.quoteIdentifiers = false;
      await seq.query(this.insertQuery);
      const [users] = await seq.query(`select * from ${qq(this.User.tableName)}`);
      expect(users.map(u => { return u.username; })).to.include('john');
    });

    it('executes select query with dot notation results', async function() {
      await this.sequelize.query(`DELETE FROM ${qq(this.User.tableName)}`);
      await this.sequelize.query(this.insertQuery);
      const [users] = await this.sequelize.query(`select username as ${qq('user.username')} from ${qq(this.User.tableName)}`);
      expect(users).to.deep.equal([{ 'user.username': 'john' }]);
    });

    it('executes select query with dot notation results and nest it', async function() {
      await this.sequelize.query(`DELETE FROM ${qq(this.User.tableName)}`);
      await this.sequelize.query(this.insertQuery);
      const users = await this.sequelize.query(`select username as ${qq('user.username')} from ${qq(this.User.tableName)}`, { raw: true, nest: true });
      expect(users.map(u => { return u.user; })).to.deep.equal([{ 'username': 'john' }]);
    });

    if (dialect === 'mysql') {
      it('executes stored procedures', async function() {
        await this.sequelize.query(this.insertQuery);
        await this.sequelize.query('DROP PROCEDURE IF EXISTS foo');

        await this.sequelize.query(
          `CREATE PROCEDURE foo()\nSELECT * FROM ${this.User.tableName};`
        );

        const users = await this.sequelize.query('CALL foo()');
        expect(users.map(u => { return u.username; })).to.include('john');
      });
    } else {
      console.log('FIXME: I want to be supported in this dialect as well :-(');
    }

    it('uses the passed model', async function() {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        model: this.User
      });

      expect(users[0]).to.be.instanceof(this.User);
    });

    it('maps the field names to attributes based on the passed model', async function() {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        model: this.User,
        mapToModel: true
      });

      expect(users[0].emailAddress).to.be.equal('john@gmail.com');
    });

    it('arbitrarily map the field names', async function() {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        type: 'SELECT',
        fieldMap: { username: 'userName', email_address: 'email' }
      });

      expect(users[0].userName).to.be.equal('john');
      expect(users[0].email).to.be.equal('john@gmail.com');
    });

    it('keeps field names that are mapped to the same name', async function() {
      await this.sequelize.query(this.insertQuery);

      const users = await this.sequelize.query(`SELECT * FROM ${qq(this.User.tableName)};`, {
        type: 'SELECT',
        fieldMap: { username: 'username', email_address: 'email' }
      });

      expect(users[0].username).to.be.equal('john');
      expect(users[0].email).to.be.equal('john@gmail.com');
    });

    describe('rejections', () => {
      it('reject if `values` and `options.replacements` are both passed', async function() {
        await this.sequelize.query({ query: 'select ? as foo, ? as bar', values: [1, 2] }, { raw: true, replacements: [1, 2] })
          .should.be.rejectedWith(Error, 'Both `sql.values` and `options.replacements` cannot be set at the same time');
      });

      it('reject if `sql.bind` and `options.bind` are both passed', async function() {
        await this.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2] }, { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, 'Both `sql.bind` and `options.bind` cannot be set at the same time');
      });

      it('reject if `options.replacements` and `options.bind` are both passed', async function() {
        await this.sequelize.query('select $1 + ? as foo, $2 + ? as bar', { raw: true, bind: [1, 2], replacements: [1, 2] })
          .should.be.rejectedWith(Error, 'Both `replacements` and `bind` cannot be set at the same time');
      });

      it('reject if `sql.bind` and `sql.values` are both passed', async function() {
        await this.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2], values: [1, 2] }, { raw: true })
          .should.be.rejectedWith(Error, 'Both `replacements` and `bind` cannot be set at the same time');
      });

      it('reject if `sql.bind` and `options.replacements`` are both passed', async function() {
        await this.sequelize.query({ query: 'select $1 + ? as foo, $2 + ? as bar', bind: [1, 2] }, { raw: true, replacements: [1, 2] })
          .should.be.rejectedWith(Error, 'Both `replacements` and `bind` cannot be set at the same time');
      });

      it('reject if `options.bind` and `sql.replacements` are both passed', async function() {
        await this.sequelize.query({ query: 'select $1 + ? as foo, $1 _ ? as bar', values: [1, 2] }, { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, 'Both `replacements` and `bind` cannot be set at the same time');
      });

      it('reject when key is missing in the passed object', async function() {
        await this.sequelize.query('select :one as foo, :two as bar, :three as baz', { raw: true, replacements: { one: 1, two: 2 } })
          .should.be.rejectedWith(Error, /Named parameter ":\w+" has no value in the given object\./g);
      });

      it('reject with the passed number', async function() {
        await this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: 2 })
          .should.be.rejectedWith(Error, /Named parameter ":\w+" has no value in the given object\./g);
      });

      it('reject with the passed empty object', async function() {
        await this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: {} })
          .should.be.rejectedWith(Error, /Named parameter ":\w+" has no value in the given object\./g);
      });

      it('reject with the passed string', async function() {
        await this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: 'foobar' })
          .should.be.rejectedWith(Error, /Named parameter ":\w+" has no value in the given object\./g);
      });

      it('reject with the passed date', async function() {
        await this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: new Date() })
          .should.be.rejectedWith(Error, /Named parameter ":\w+" has no value in the given object\./g);
      });

      it('reject when binds passed with object and numeric $1 is also present', async function() {
        const typeCast = dialect === 'postgres' ? '::int' : '';

        await this.sequelize.query(`select $one${typeCast} as foo, $two${typeCast} as bar, '$1' as baz`, {  raw: true, bind: { one: 1, two: 2 } })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject when binds passed as array and $alpha is also present', async function() {
        const typeCast = dialect === 'postgres' ? '::int' : '';

        await this.sequelize.query(`select $1${typeCast} as foo, $2${typeCast} as bar, '$foo' as baz`, { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject when bind key is $0 with the passed array', async function() {
        await this.sequelize.query('select $1 as foo, $0 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject when bind key is $01 with the passed array', async function() {
        await this.sequelize.query('select $1 as foo, $01 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject when bind key is missing in the passed array', async function() {
        await this.sequelize.query('select $1 as foo, $2 as bar, $3 as baz', { raw: true, bind: [1, 2] })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject when bind key is missing in the passed object', async function() {
        await this.sequelize.query('select $one as foo, $two as bar, $three as baz', { raw: true, bind: { one: 1, two: 2 } })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject with the passed number for bind', async function() {
        await this.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: 2 })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject with the passed empty object for bind', async function() {
        await this.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: {} })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject with the passed string for bind', async function() {
        await this.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: 'foobar' })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });

      it('reject with the passed date for bind', async function() {
        await this.sequelize.query('select $one as foo, $two as bar', { raw: true, bind: new Date() })
          .should.be.rejectedWith(Error, /Named bind parameter "\$\w+" has no value in the given object\./g);
      });
    });

    it('properly adds and escapes replacement value', async function() {
      let logSql;
      const number  = 1,
        date = new Date(),
        string = 't\'e"st',
        boolean = true,
        buffer = Buffer.from('t\'e"st');

      date.setMilliseconds(0);

      const result = await this.sequelize.query({
        query: 'select ? as number, ? as date,? as string,? as boolean,? as buffer',
        values: [number, date, string, boolean, buffer]
      }, {
        type: this.sequelize.QueryTypes.SELECT,
        logging(s) {
          logSql = s;
        }
      });

      const res = result[0] || {};
      res.date = res.date && new Date(res.date);
      res.boolean = res.boolean && true;
      if (typeof res.buffer === 'string' && res.buffer.startsWith('\\x')) {
        res.buffer = Buffer.from(res.buffer.substring(2), 'hex');
      }
      expect(res).to.deep.equal({
        number,
        date,
        string,
        boolean,
        buffer
      });
      expect(logSql).to.not.include('?');
    });

    it('it allows to pass custom class instances', async function() {
      let logSql;
      class SQLStatement {
        constructor() {
          this.values = [1, 2];
        }
        get query() {
          return 'select ? as foo, ? as bar';
        }
      }
      const result = await this.sequelize.query(new SQLStatement(), { type: this.sequelize.QueryTypes.SELECT, logging: s => logSql = s } );
      expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
      expect(logSql).to.not.include('?');
    });

    it('uses properties `query` and `values` if query is tagged', async function() {
      let logSql;
      const result = await this.sequelize.query({ query: 'select ? as foo, ? as bar', values: [1, 2] }, { type: this.sequelize.QueryTypes.SELECT, logging(s) { logSql = s; } });
      expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
      expect(logSql).to.not.include('?');
    });

    it('uses properties `query` and `bind` if query is tagged', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      let logSql;
      const result = await this.sequelize.query({ query: `select $1${typeCast} as foo, $2${typeCast} as bar`, bind: [1, 2] }, { type: this.sequelize.QueryTypes.SELECT, logging(s) { logSql = s; } });
      expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
      if (dialect === 'postgres' || dialect === 'sqlite') {
        expect(logSql).to.include('$1');
        expect(logSql).to.include('$2');
      } else if (dialect === 'mssql') {
        expect(logSql).to.include('@0');
        expect(logSql).to.include('@1');
      } else if (dialect === 'mysql') {
        expect(logSql.match(/\?/g).length).to.equal(2);
      }
    });

    it('dot separated attributes when doing a raw query without nest', async function() {
      const tickChar = dialect === 'postgres' || dialect === 'mssql' ? '"' : '`',
        sql = `select 1 as ${Sequelize.Utils.addTicks('foo.bar.baz', tickChar)}`;

      await expect(this.sequelize.query(sql, { raw: true, nest: false }).then(obj => obj[0])).to.eventually.deep.equal([{ 'foo.bar.baz': 1 }]);
    });

    it('destructs dot separated attributes when doing a raw query using nest', async function() {
      const tickChar = dialect === 'postgres' || dialect === 'mssql' ? '"' : '`',
        sql = `select 1 as ${Sequelize.Utils.addTicks('foo.bar.baz', tickChar)}`;

      const result = await this.sequelize.query(sql, { raw: true, nest: true });
      expect(result).to.deep.equal([{ foo: { bar: { baz: 1 } } }]);
    });

    it('replaces token with the passed array', async function() {
      const result = await this.sequelize.query('select ? as foo, ? as bar', { type: this.sequelize.QueryTypes.SELECT, replacements: [1, 2] });
      expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
    });

    it('replaces named parameters with the passed object', async function() {
      await expect(this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: { one: 1, two: 2 } }).then(obj => obj[0]))
        .to.eventually.deep.equal([{ foo: 1, bar: 2 }]);
    });

    it('replaces named parameters with the passed object and ignore those which does not qualify', async function() {
      await expect(this.sequelize.query('select :one as foo, :two as bar, \'00:00\' as baz', { raw: true, replacements: { one: 1, two: 2 } }).then(obj => obj[0]))
        .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: '00:00' }]);
    });

    it('replaces named parameters with the passed object using the same key twice', async function() {
      await expect(this.sequelize.query('select :one as foo, :two as bar, :one as baz', { raw: true, replacements: { one: 1, two: 2 } }).then(obj => obj[0]))
        .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: 1 }]);
    });

    it('replaces named parameters with the passed object having a null property', async function() {
      await expect(this.sequelize.query('select :one as foo, :two as bar', { raw: true, replacements: { one: 1, two: null } }).then(obj => obj[0]))
        .to.eventually.deep.equal([{ foo: 1, bar: null }]);
    });

    it('binds token with the passed array', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      let logSql;
      const result = await this.sequelize.query(`select $1${typeCast} as foo, $2${typeCast} as bar`, { type: this.sequelize.QueryTypes.SELECT, bind: [1, 2], logging(s) { logSql = s;} });
      expect(result).to.deep.equal([{ foo: 1, bar: 2 }]);
      if (dialect === 'postgres' || dialect === 'sqlite') {
        expect(logSql).to.include('$1');
      }
    });

    it('binds named parameters with the passed object', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      let logSql;
      const result = await this.sequelize.query(`select $one${typeCast} as foo, $two${typeCast} as bar`, { raw: true, bind: { one: 1, two: 2 }, logging(s) { logSql = s; } });
      expect(result[0]).to.deep.equal([{ foo: 1, bar: 2 }]);
      if (dialect === 'postgres') {
        expect(logSql).to.include('$1');
      }
      if (dialect === 'sqlite') {
        expect(logSql).to.include('$one');
      }
    });

    it('binds named parameters with the passed object using the same key twice', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      let logSql;
      const result = await this.sequelize.query(`select $one${typeCast} as foo, $two${typeCast} as bar, $one${typeCast} as baz`, { raw: true, bind: { one: 1, two: 2 }, logging(s) { logSql = s; } });
      expect(result[0]).to.deep.equal([{ foo: 1, bar: 2, baz: 1 }]);
      if (dialect === 'postgres') {
        expect(logSql).to.include('$1');
        expect(logSql).to.include('$2');
        expect(logSql).to.not.include('$3');
      }
    });

    it('binds named parameters with the passed object having a null property', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      const result = await this.sequelize.query(`select $one${typeCast} as foo, $two${typeCast} as bar`, { raw: true, bind: { one: 1, two: null } });
      expect(result[0]).to.deep.equal([{ foo: 1, bar: null }]);
    });

    it('binds named parameters array handles escaped $$', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      let logSql;
      const result = await this.sequelize.query(`select $1${typeCast} as foo, '$$ / $$1' as bar`, { raw: true, bind: [1], logging(s) { logSql = s;} });
      expect(result[0]).to.deep.equal([{ foo: 1, bar: '$ / $1' }]);
      if (dialect === 'postgres' || dialect === 'sqlite') {
        expect(logSql).to.include('$1');
      }
    });

    it('binds named parameters object handles escaped $$', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      const result = await this.sequelize.query(`select $one${typeCast} as foo, '$$ / $$one' as bar`, { raw: true, bind: { one: 1 } });
      expect(result[0]).to.deep.equal([{ foo: 1, bar: '$ / $one' }]);
    });

    it('escape where has $ on the middle of characters', async function() {
      const typeCast = dialect === 'postgres' ? '::int' : '';
      const result = await this.sequelize.query(`select $one${typeCast} as foo$bar`, { raw: true, bind: { one: 1 } });
      expect(result[0]).to.deep.equal([{ foo$bar: 1 }]);
    });

    if (dialect === 'postgres' || dialect === 'sqlite' || dialect === 'mssql') {
      it('does not improperly escape arrays of strings bound to named parameters', async function() {
        const result = await this.sequelize.query('select :stringArray as foo', { raw: true, replacements: { stringArray: ['"string"'] } });
        expect(result[0]).to.deep.equal([{ foo: '"string"' }]);
      });
    }

    it('handles AS in conjunction with functions just fine', async function() {
      let datetime = dialect === 'sqlite' ? 'date(\'now\')' : 'NOW()';
      if (dialect === 'mssql') {
        datetime = 'GETDATE()';
      }

      const [result] = await this.sequelize.query(`SELECT ${datetime} AS t`);
      expect(moment(result[0].t).isValid()).to.be.true;
    });

    if (Support.getTestDialect() === 'postgres') {
      it('replaces named parameters with the passed object and ignores casts', async function() {
        await expect(this.sequelize.query('select :one as foo, :two as bar, \'1000\'::integer as baz', { raw: true, replacements: { one: 1, two: 2 } }).then(obj => obj[0]))
          .to.eventually.deep.equal([{ foo: 1, bar: 2, baz: 1000 }]);
      });

      it('supports WITH queries', async function() {
        await expect(this.sequelize.query('WITH RECURSIVE t(n) AS ( VALUES (1) UNION ALL SELECT n+1 FROM t WHERE n < 100) SELECT sum(n) FROM t').then(obj => obj[0]))
          .to.eventually.deep.equal([{ 'sum': '5050' }]);
      });
    }
  });
});
