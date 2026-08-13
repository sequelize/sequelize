import * as chai from 'chai';
import sinon from 'sinon';
import defaultInflection from 'inflection';
import Support from './support.js';
import DataTypes from '../../lib/data-types.js';
import * as Utils from '../../lib/utils.js';
import Op from '../../lib/operators.js';

/* eslint-disable camelcase */

const expect = chai.expect;

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
      expect(Utils.defaults({ a: 1, c: 3 }, { b: 2 }, { c: 4, d: 4 })).to.eql({
        a: 1,
        b: 2,
        c: 3,
        d: 4
      });
    });

    it('defaults symbol keys', () => {
      expect(Utils.defaults({ a: 1, [Op.eq]: 3 }, { b: 2 }, { [Op.eq]: 4, [Op.ne]: 4 })).to.eql({
        a: 1,
        b: 2,
        [Op.eq]: 3,
        [Op.ne]: 4
      });
    });
  });

  describe('mapFinderOptions', () => {
    it('virtual attribute dependencies', () => {
      expect(
        Utils.mapFinderOptions(
          {
            attributes: ['active']
          },
          Support.sequelize.define('User', {
            createdAt: {
              type: DataTypes.DATE,
              field: 'created_at'
            },
            active: {
              type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt'])
            }
          })
        ).attributes
      ).to.eql([['created_at', 'createdAt']]);
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
          Utils.mapFinderOptions(
            {
              attributes: ['active']
            },
            Model
          ),
          Model
        ).attributes
      ).to.eql([['created_at', 'createdAt']]);
    });
  });

  describe('mapOptionFieldNames', () => {
    it('plain where', () => {
      expect(
        Utils.mapOptionFieldNames(
          {
            where: {
              firstName: 'Paul',
              lastName: 'Atreides'
            }
          },
          Support.sequelize.define('User', {
            firstName: {
              type: DataTypes.STRING,
              field: 'first_name'
            },
            lastName: {
              type: DataTypes.STRING,
              field: 'last_name'
            }
          })
        )
      ).to.eql({
        where: {
          first_name: 'Paul',
          last_name: 'Atreides'
        }
      });
    });

    it('$or where', () => {
      expect(
        Utils.mapOptionFieldNames(
          {
            where: {
              $or: {
                firstName: 'Paul',
                lastName: 'Atreides'
              }
            }
          },
          Support.sequelize.define('User', {
            firstName: {
              type: DataTypes.STRING,
              field: 'first_name'
            },
            lastName: {
              type: DataTypes.STRING,
              field: 'last_name'
            }
          })
        )
      ).to.eql({
        where: {
          $or: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });

    it('$or[] where', () => {
      expect(
        Utils.mapOptionFieldNames(
          {
            where: {
              $or: [{ firstName: 'Paul' }, { lastName: 'Atreides' }]
            }
          },
          Support.sequelize.define('User', {
            firstName: {
              type: DataTypes.STRING,
              field: 'first_name'
            },
            lastName: {
              type: DataTypes.STRING,
              field: 'last_name'
            }
          })
        )
      ).to.eql({
        where: {
          $or: [{ first_name: 'Paul' }, { last_name: 'Atreides' }]
        }
      });
    });

    it('$and where', () => {
      expect(
        Utils.mapOptionFieldNames(
          {
            where: {
              $and: {
                firstName: 'Paul',
                lastName: 'Atreides'
              }
            }
          },
          Support.sequelize.define('User', {
            firstName: {
              type: DataTypes.STRING,
              field: 'first_name'
            },
            lastName: {
              type: DataTypes.STRING,
              field: 'last_name'
            }
          })
        )
      ).to.eql({
        where: {
          $and: {
            first_name: 'Paul',
            last_name: 'Atreides'
          }
        }
      });
    });
  });

  describe('stack', () => {
    // eslint-disable-next-line prefer-arrow-callback
    it('stack trace starts after call to Util.stack()', function this_here_test() {
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
      expectsql(
        run(
          sql.fn(
            'SUM',
            sql.cast(
              {
                $or: {
                  foo: 'foo',
                  bar: 'bar'
                }
              },
              'int'
            )
          )
        ),
        {
          default: "SUM(CAST(([foo] = 'foo' OR [bar] = 'bar') AS INT))"
        }
      );
    });
  });

  describe('useInflection', () => {
    const fake = {
      pluralize: () => 'fake-plural',
      singularize: () => 'fake-singular',
      underscore: () => 'fake-underscore'
    };

    // Stubbed for every case, not just the two that assert on it: restoring the
    // real module in afterEach is itself a post-use swap, so an unstubbed logger
    // would print a (correct but irrelevant) warning after each test.
    let warn;

    beforeEach(() => {
      warn = sinon.stub(Utils.getLogger(), 'warn');
    });

    afterEach(() => {
      Utils.useInflection(defaultInflection);
      sinon.restore();
    });

    it('routes pluralize, singularize and underscore through the replacement', () => {
      Utils.useInflection(fake);

      expect(Utils.pluralize('user')).to.equal('fake-plural');
      expect(Utils.singularize('users')).to.equal('fake-singular');
      expect(Utils.underscore('userName')).to.equal('fake-underscore');
    });

    it('throws listing every missing method', () => {
      expect(() => Utils.useInflection({ pluralize: () => '' })).to.throw(/missing: singularize, underscore/);
      expect(() => Utils.useInflection(undefined)).to.throw(/missing: pluralize, singularize, underscore/);
    });

    it('rejects non-function properties', () => {
      expect(() => Utils.useInflection({ ...fake, singularize: 'nope' })).to.throw(/missing: singularize/);
    });

    it('warns when called after names have already been inflected', () => {
      Utils.useInflection(fake);
      Utils.pluralize('user');
      Utils.useInflection(fake);

      expect(warn.calledOnce).to.be.true;
      expect(warn.firstCall.args[0]).to.match(/call useInflection before defining any model/);
    });

    it('does not warn when the outgoing implementation was never used', () => {
      Utils.useInflection(fake);
      Utils.useInflection(fake);

      expect(warn.called).to.be.false;
    });
  });

  describe('Logger', () => {
    const logger = Utils.getLogger();

    it('deprecate', () => {
      expect(logger.deprecate).to.be.a('function');
      logger.deprecate('test deprecation');
    });

    it('debug', () => {
      expect(logger.debug).to.be.a('function');
      logger.debug('test debug');
    });

    it('warn', () => {
      expect(logger.warn).to.be.a('function');
      logger.warn('test warning');
    });

    it('debugContext', () => {
      expect(logger.debugContext).to.be.a('function');
      const testLogger = logger.debugContext('test');

      expect(testLogger).to.be.a('function');
      expect(testLogger.namespace).to.be.eql('sequelize:test');
    });
  });
});
