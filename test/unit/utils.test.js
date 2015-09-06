'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , Utils     = require(__dirname + '/../../lib/utils');

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('Utils'), function() {

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
});