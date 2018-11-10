'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/support');
const DataTypes = require(__dirname + '/../../lib/data-types');
const Utils = require(__dirname + '/../../lib/utils');
const tedious = require('tedious');
const tediousIsolationLevel = tedious.ISOLATION_LEVEL;

suite(Support.getTestDialectTeaser('Utils'), () => {
  suite('merge', () => {
    test('does not clone sequelize models', () => {
      const User = Support.sequelize.define('user');
      const merged = Utils.merge({}, { include: [{model: User }]});
      const merged2 = Utils.merge({}, { user: User });

      expect(merged.include[0].model).to.equal(User);
      expect(merged2.user).to.equal(User);
    });
  });

  suite('toDefaultValue', () => {
    test('return plain data types', () => {
      expect(Utils.toDefaultValue(DataTypes.UUIDV4)).to.equal('UUIDV4');
    });
    test('return uuid v1', () => {
      expect(/^[a-z0-9\-]{36}$/.test(Utils.toDefaultValue(DataTypes.UUIDV1()))).to.be.equal(true);
    });
    test('return uuid v4', () => {
      expect(/^[a-z0-9\-]{36}/.test(Utils.toDefaultValue(DataTypes.UUIDV4()))).to.be.equal(true);
    });
    test('return now', () => {
      expect(Object.prototype.toString.call(Utils.toDefaultValue(DataTypes.NOW()))).to.be.equal('[object Date]');
    });
    test('return plain string', () => {
      expect(Utils.toDefaultValue('Test')).to.equal('Test');
    });
    test('return plain object', () => {
      chai.assert.deepEqual({}, Utils.toDefaultValue({}));
    });
  });

  suite('defaults', () => {
    test('defaults normal object', () => {
      expect(Utils.defaults(
        { a: 1, c: 3},
        { b: 2 },
        { c: 4, d: 4 }
      )).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4
      });
    });

    test('defaults symbol keys', () => {
      expect(Utils.defaults(
        { a: 1, [Symbol.for('c')]: 3},
        { b: 2 },
        { [Symbol.for('c')]: 4, [Symbol.for('d')]: 4 }
      )).to.eql({
        a: 1,
        b: 2,
        [Symbol.for('c')]: 3,
        [Symbol.for('d')]: 4
      });
    });
  });

  suite('mapFinderOptions', () => {
    test('virtual attribute dependencies', () => {
      expect(Utils.mapFinderOptions({
        attributes: [
          'active'
        ]
      }, Support.sequelize.define('User', {
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at'
        },
        active: {
          type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt'])
        }
      })).attributes).to.eql([
        [
          'created_at',
          'createdAt'
        ]
      ]);
    });

    test('multiple calls', () => {
      const Model = Support.sequelize.define('User', {
        createdAt: {
          type: DataTypes.DATE,
          field: 'created_at'
        },
        active: {
          type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt'])
        }
      });

      expect(
        Utils.mapFinderOptions(
          Utils.mapFinderOptions({
            attributes: [
              'active'
            ]
          }, Model),
          Model
        ).attributes
      ).to.eql([
        [
          'created_at',
          'createdAt'
        ]
      ]);
    });
  });

  suite('mapOptionFieldNames', () => {
    test('plain where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          firstName: 'Paul',
          lastName: 'Atreides'
        }
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name'
        }
      }))).to.eql({
        where: {
          first_name: 'Paul',
          last_name: 'Atreides'
        }
      });
    });

    test('$or where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          $or: {
            firstName: 'Paul',
            lastName: 'Atreides'
          }
        }
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name'
        }
      }))).to.eql({
        where: {
          $or: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });

    test('$or[] where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          $or: [
            {firstName: 'Paul'},
            {lastName: 'Atreides'}
          ]
        }
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name'
        }
      }))).to.eql({
        where: {
          $or: [
            {first_name: 'Paul'},
            {last_name: 'Atreides'}
          ]
        }
      });
    });

    test('$and where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          $and: {
            firstName: 'Paul',
            lastName: 'Atreides'
          }
        }
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name'
        }
      }))).to.eql({
        where: {
          $and: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });
  });

  suite('stack', () => {
    test('stack trace starts after call to Util.stack()', function this_here_test() { // eslint-disable-line
      // We need a named function to be able to capture its trace
      function a() {
        return b();
      }

      function b() {
        return c();
      }

      function c() {
        return Utils.stack();
      }

      const stack = a();

      expect(stack[0].getFunctionName()).to.eql('c');
      expect(stack[1].getFunctionName()).to.eql('b');
      expect(stack[2].getFunctionName()).to.eql('a');
      expect(stack[3].getFunctionName()).to.eql('this_here_test');
    });
  });

  suite('Sequelize.cast', () => {
    const sql = Support.sequelize;
    const generator = sql.queryInterface.QueryGenerator;
    const run = generator.handleSequelizeMethod.bind(generator);
    const expectsql = Support.expectsql;

    test('accepts condition object (auto casting)', () => {
      expectsql(run(sql.fn('SUM', sql.cast({
        $or: {
          foo: 'foo',
          bar: 'bar'
        }
      }, 'int'))), {
        default: 'SUM(CAST(([foo] = \'foo\' OR [bar] = \'bar\') AS INT))',
        mssql: 'SUM(CAST(([foo] = N\'foo\' OR [bar] = N\'bar\') AS INT))'
      });
    });
  });

  suite('Logger', () => {
    const logger = Utils.getLogger();

    test('deprecate', () => {
      expect(logger.deprecate).to.be.a('function');
      logger.deprecate('test deprecation');
    });

    test('debug', () => {
      expect(logger.debug).to.be.a('function');
      logger.debug('test debug');
    });

    test('warn', () => {
      expect(logger.warn).to.be.a('function');
      logger.warn('test warning');
    });

    test('debugContext',  () => {
      expect(logger.debugContext).to.be.a('function');
      const testLogger = logger.debugContext('test');

      expect(testLogger).to.be.a('function');
      expect(testLogger.namespace).to.be.eql('sequelize:test');
    });
  });

  if (Support.getTestDialect() === 'mssql') {
    suite('mapIsolationLevelStringToTedious', () => {
      test('READ_UNCOMMITTED', () => {
        expect(Utils.mapIsolationLevelStringToTedious('READ_UNCOMMITTED', tedious)).to.equal(tediousIsolationLevel.READ_UNCOMMITTED);
      });

      test('READ_COMMITTED', () => {
        expect(Utils.mapIsolationLevelStringToTedious('READ_COMMITTED', tedious)).to.equal(tediousIsolationLevel.READ_COMMITTED);
      });

      test('REPEATABLE_READ', () => {
        expect(Utils.mapIsolationLevelStringToTedious('REPEATABLE_READ', tedious)).to.equal(tediousIsolationLevel.REPEATABLE_READ);
      });

      test('SERIALIZABLE', () => {
        expect(Utils.mapIsolationLevelStringToTedious('SERIALIZABLE', tedious)).to.equal(tediousIsolationLevel.SERIALIZABLE);
      });

      test('SNAPSHOT', () => {
        expect(Utils.mapIsolationLevelStringToTedious('SNAPSHOT', tedious)).to.equal(tediousIsolationLevel.SNAPSHOT);
      });

      test('should throw error if tedious lib is not passed as a parameter', () => {
        expect(Utils.mapIsolationLevelStringToTedious.bind(Utils, 'SNAPSHOT')).to.throw('An instance of tedious lib should be passed to this function');
      });
    });
  }

});
