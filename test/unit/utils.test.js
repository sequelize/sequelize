'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , Utils     = require(__dirname + '/../../lib/utils')
  , Support   = require(__dirname + '/../support');

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('Utils'), function() {
  suite('merge', function () {
    test('does not clone sequelize models', function () {
      var User = this.sequelize.define('user')
        , merged = Utils.merge({}, { include: [{model : User }]})
        , merged2 = Utils.merge({}, { user: User });

      expect(merged.include[0].model).to.equal(User);
      expect(merged2.user).to.equal(User);
    });
  });

  suite('toDefaultValue', function () {
    test('return plain data types', function () {
      expect(Utils.toDefaultValue(DataTypes.UUIDV4)).to.equal('UUIDV4');
    });
    test('return uuid v1', function () {
      expect(/^[a-z0-9\-]{36}$/.test(Utils.toDefaultValue(DataTypes.UUIDV1()))).to.be.equal(true);
    });
    test('return uuid v4', function () {
      expect(/^[a-z0-9\-]{36}/.test(Utils.toDefaultValue(DataTypes.UUIDV4()))).to.be.equal(true);
    });
    test('return now', function () {
      expect(Object.prototype.toString.call(Utils.toDefaultValue(DataTypes.NOW()))).to.be.equal('[object Date]');
    });
    test('return plain string', function () {
      expect(Utils.toDefaultValue('Test')).to.equal('Test');
    });
    test('return plain object', function () {
      chai.assert.deepEqual({}, Utils.toDefaultValue({}));
    });
  });

  suite('mapFinderOptions', function () {
    test('virtual attribute dependencies', function () {
      expect(Utils.mapFinderOptions({
        attributes: [
          'active'
        ]
      }, this.sequelize.define('User', {
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

    test('multiple calls', function () {
      var Model = this.sequelize.define('User', {
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

  suite('mapOptionFieldNames', function () {
    test('plain where', function () {
      expect(Utils.mapOptionFieldNames({
        where: {
          firstName: 'Paul',
          lastName: 'Atreides'
        }
      }, this.sequelize.define('User', {
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

    test('$or where', function () {
      expect(Utils.mapOptionFieldNames({
        where: {
          $or: {
            firstName: 'Paul',
            lastName: 'Atreides'
          }
        }
      }, this.sequelize.define('User', {
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

    test('$or[] where', function () {
      expect(Utils.mapOptionFieldNames({
        where: {
          $or: [
            {firstName: 'Paul'},
            {lastName: 'Atreides'}
          ]
        }
      }, this.sequelize.define('User', {
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

    test('$and where', function () {
      expect(Utils.mapOptionFieldNames({
        where: {
          $and: {
            firstName: 'Paul',
            lastName: 'Atreides'
          }
        }
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
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
      var Location = this.sequelize.define('Location', {
        latLong: {
          type: DataTypes.STRING,
          field: 'lat_long'
        }
      });
      var Item = this.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[Item, Location, 'latLong', 'DESC'], ['lastName', 'ASC']]
      }, this.sequelize.define('User', {
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[Item, Location, 'lat_long', 'DESC'], ['lastName', 'ASC']]
      });
    });
    test('multi field alias sub model no direction order', function() {
      var Location = this.sequelize.define('Location', {
        latLong: {
          type: DataTypes.STRING,
          field: 'lat_long'
        }
      });
      var Item = this.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[Item, Location, 'latLong'], ['lastName', 'ASC']]
      }, this.sequelize.define('User', {
        lastName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[Item, Location, 'lat_long'], ['lastName', 'ASC']]
      });
    });
    test('function order', function() {
      var fn = this.sequelize.fn('otherfn', 123);
      expect(Utils.mapOptionFieldNames({
        order: [[fn, 'ASC']]
      }, this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[fn, 'ASC']]
      });
    });
    test('function no direction order', function() {
      var fn = this.sequelize.fn('otherfn', 123);
      expect(Utils.mapOptionFieldNames({
        order: [[fn]]
      }, this.sequelize.define('User', {
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
      }, this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        }
      }))).to.eql({
        order: [['first_name']]
      });
    });
    test('model alias order', function() {
      var Item = this.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'fontColor', 'ASC']]
      }, this.sequelize.define('User', {
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
      var Item = this.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'fontColor']]
      }, this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[{ model: Item, as: 'another'}, 'font_color']]
      });
    });
    test('model alias wrong field order', function() {
      var Item = this.sequelize.define('Item', {
        fontColor: {
          type: DataTypes.STRING,
          field: 'font_color'
        }
      });
      expect(Utils.mapOptionFieldNames({
        order: [[{ model: Item, as: 'another'}, 'firstName', 'ASC']]
      }, this.sequelize.define('User', {
        firstName: {
          type: DataTypes.STRING
        }
      }))).to.eql({
        order: [[{ model: Item, as: 'another'}, 'firstName', 'ASC']]
      });
    });

  });

  suite('stack', function() {
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

      var stack = a();

      expect(stack[0].getFunctionName()).to.eql('c');
      expect(stack[1].getFunctionName()).to.eql('b');
      expect(stack[2].getFunctionName()).to.eql('a');
      expect(stack[3].getFunctionName()).to.eql('this_here_test');
    });
  });

  suite('formatReferences', function () {
    ([
      [{referencesKey: 1}, {references: {model: undefined, key: 1, deferrable: undefined}, referencesKey: undefined, referencesDeferrable: undefined}],
      [{references: 'a'}, {references: {model: 'a', key: undefined, deferrable: undefined}, referencesKey: undefined, referencesDeferrable: undefined}],
      [{references: 'a', referencesKey: 1}, {references: {model: 'a', key: 1, deferrable: undefined}, referencesKey: undefined, referencesDeferrable: undefined}],
      [{references: {model: 1}}, {references: {model: 1}}],
      [{references: 1, referencesKey: 2, referencesDeferrable: 3}, {references: {model: 1, key: 2, deferrable: 3}, referencesKey: undefined, referencesDeferrable: undefined}]
    ]).forEach(function (test) {
      var input  = test[0];
      var output = test[1];

      it(JSON.stringify(input) + ' to ' + JSON.stringify(output), function () {
        expect(Utils.formatReferences(input)).to.deep.equal(output);
      });
    });
  });

  suite('Sequelize.cast', function() {
    var sql = Support.sequelize;
    var generator = sql.queryInterface.QueryGenerator;
    var run = generator.handleSequelizeMethod.bind(generator);
    var expectsql = Support.expectsql;

    test('accepts condition object (auto casting)', function fn() {
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
});
