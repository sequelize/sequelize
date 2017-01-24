'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/support');
const DataTypes = require(__dirname + '/../../lib/data-types');
const Utils = require(__dirname + '/../../lib/utils');

suite(Support.getTestDialectTeaser('Utils'), () => {
  suite('merge', () => {
    test('does not clone sequelize models', () => {
      const User = Support.sequelize.define('user');
      const merged = Utils.merge({}, { include: [{model : User }]});
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

    test('string field order', function() {
      expect(Utils.mapOptionFieldNames({
        order: 'firstName DESC'
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        }
      }))).to.eql({
        order: 'firstName DESC'
      });
    });

    test('string in array order', function() {
      expect(Utils.mapOptionFieldNames({
        order: ['firstName DESC']
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        }
      }))).to.eql({
        order: ['firstName DESC']
      });
    });

    test('single field alias order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName', 'DESC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        }
      }))).to.eql({
        order: [['first_name', 'DESC']]
      });
    });

    test('multi field alias order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName', 'DESC'], ['lastName', 'ASC']]
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
        order: [['first_name', 'DESC'], ['last_name', 'ASC']]
      });
    });

    test('multi field alias no direction order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName'], ['lastName']]
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
        order: [['first_name'], ['last_name']]
      });
    });

    test('field alias to another field order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName', 'DESC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'lastName'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'firstName'
        }
      }))).to.eql({
        order: [['lastName', 'DESC']]
      });
    });

    test('multi field no alias order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName', 'DESC'], ['lastName', 'ASC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        },
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [['firstName', 'DESC'], ['lastName', 'ASC']]
      });
    });

    test('multi field alias sub model order', function() {
      const Location = Support.sequelize.define('Location', {
        latLong: {
          type: DataTypes.STRING,
          field: 'lat_long'
        }
      });
      const Item = Support.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[Item, Location, 'latLong', 'DESC'], ['lastName', 'ASC']]
      }, Support.sequelize.define('User', {
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[Item, Location, 'lat_long', 'DESC'], ['lastName', 'ASC']]
      });
    });

    test('multi field alias sub model no direction order', function() {
      const Location = Support.sequelize.define('Location', {
        latLong: {
          type: DataTypes.STRING,
          field: 'lat_long'
        }
      });
      const Item = Support.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[Item, Location, 'latLong'], ['lastName', 'ASC']]
      }, Support.sequelize.define('User', {
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[Item, Location, 'lat_long'], ['lastName', 'ASC']]
      });
    });

    test('function order', function() {
      const fn = Support.sequelize.fn('otherfn', 123);
      expect(Utils.mapOptionFieldNames({
        order: [[fn, 'ASC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[fn, 'ASC']]
      });
    });

    test('function no direction order', function() {
      const fn = Support.sequelize.fn('otherfn', 123);
      expect(Utils.mapOptionFieldNames({
        order: [[fn]]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[fn]]
      });
    });

    test('string no direction order', function() {
      expect(Utils.mapOptionFieldNames({
        order: [['firstName']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        }
      }))).to.eql({
        order: [['first_name']]
      });
    });

    test('model alias order', function() {
      const Item = Support.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'fontColor', 'ASC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        },
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[{ model: Item, as: 'another'}, 'font_color', 'ASC']]
      });
    });

    test('model alias no direction order', function() {
      const Item = Support.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'fontColor']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[{ model: Item, as: 'another'}, 'font_color']]
      });
    });

    test('model alias wrong field order', function() {
      const Item = Support.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'firstName', 'ASC']]
      }, Support.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[{ model: Item, as: 'another'}, 'firstName', 'ASC']]
      });
    });
  });

  suite('stack', () => {
    test('stack trace starts after call to Util.stack()', function this_here_test() {

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
      expect(logger.deprecate).to.be.function;
      logger.deprecate('test deprecation');
    });

    test('debug', () => {
      expect(logger.debug).to.be.function;
      logger.debug('test debug');
    });

    test('warn', () => {
      expect(logger.warn).to.be.function;
      logger.warn('test warning');
    });

    test('debugContext',  () => {
      expect(logger.debugContext).to.be.function;
      const testLogger = logger.debugContext('test');

      expect(testLogger).to.be.function;
      expect(testLogger.namespace).to.be.eql('sequelize:test');
    });
  });
});
