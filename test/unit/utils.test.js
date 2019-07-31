'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const DataTypes = require('../../lib/data-types');
const Utils = require('../../lib/utils');
const { logger } = require('../../lib/utils/logger');
const Op = Support.Sequelize.Op;

describe(Support.getTestDialectTeaser('Utils'), () => {
  describe('merge', () => {
    it('does not clone sequelize models', () => {
      const User = Support.sequelize.define('user');
      const merged = Utils.merge({}, { include: [{ model: User }] });
      const merged2 = Utils.merge({}, { user: User });

      expect(merged.include[0].model).to.equal(User);
      expect(merged2.user).to.equal(User);
    });
  });

  describe('toDefaultValue', () => {
    it('return plain data types', () => {
      expect(Utils.toDefaultValue(DataTypes.UUIDV4)).to.equal('UUIDV4');
    });
    it('return uuid v1', () => {
      expect(/^[a-z0-9-]{36}$/.test(Utils.toDefaultValue(DataTypes.UUIDV1()))).to.be.equal(true);
    });
    it('return uuid v4', () => {
      expect(/^[a-z0-9-]{36}/.test(Utils.toDefaultValue(DataTypes.UUIDV4()))).to.be.equal(true);
    });
    it('return now', () => {
      expect(Object.prototype.toString.call(Utils.toDefaultValue(DataTypes.NOW()))).to.be.equal('[object Date]');
    });
    it('return plain string', () => {
      expect(Utils.toDefaultValue('Test')).to.equal('Test');
    });
    it('return plain object', () => {
      chai.assert.deepEqual({}, Utils.toDefaultValue({}));
    });
  });

  describe('defaults', () => {
    it('defaults normal object', () => {
      expect(Utils.defaults(
        { a: 1, c: 3 },
        { b: 2 },
        { c: 4, d: 4 }
      )).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4
      });
    });

    it('defaults symbol keys', () => {
      expect(Utils.defaults(
        { a: 1, [Symbol.for('c')]: 3 },
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

  describe('mapFinderOptions', () => {
    it('virtual attribute dependencies', () => {
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

    it('multiple calls', () => {
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

  describe('mapOptionFieldNames', () => {
    it('plain where', () => {
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

    it('Op.or where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          [Op.or]: {
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
          [Op.or]: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });

    it('Op.or[] where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          [Op.or]: [
            { firstName: 'Paul' },
            { lastName: 'Atreides' }
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
          [Op.or]: [
            { first_name: 'Paul' },
            { last_name: 'Atreides' }
          ]
        }
      });
    });

    it('$and where', () => {
      expect(Utils.mapOptionFieldNames({
        where: {
          [Op.and]: {
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
          [Op.and]: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });
  });

  describe('stack', () => {
    it('stack trace starts after call to Util.stack()', function this_here_test() { // eslint-disable-line
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

  describe('Sequelize.cast', () => {
    const sql = Support.sequelize;
    const generator = sql.queryInterface.QueryGenerator;
    const run = generator.handleSequelizeMethod.bind(generator);
    const expectsql = Support.expectsql;

    it('accepts condition object (auto casting)', () => {
      expectsql(run(sql.fn('SUM', sql.cast({
        [Op.or]: {
          foo: 'foo',
          bar: 'bar'
        }
      }, 'int'))), {
        default: 'SUM(CAST(([foo] = \'foo\' OR [bar] = \'bar\') AS INT))',
        mssql: 'SUM(CAST(([foo] = N\'foo\' OR [bar] = N\'bar\') AS INT))'
      });
    });
  });

  describe('Logger', () => {
    it('debug', () => {
      expect(logger.debugContext).to.be.a('function');
      logger.debugContext('test debug');
    });

    it('warn', () => {
      expect(logger.warn).to.be.a('function');
      logger.warn('test warning');
    });

    it('debugContext',  () => {
      expect(logger.debugContext).to.be.a('function');
      const testLogger = logger.debugContext('test');

      expect(testLogger).to.be.a('function');
    });
  });
});
