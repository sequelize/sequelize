'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Utils = require(__dirname + '/../../lib/utils'),
  Support = require(__dirname + '/support'),
  DataTypes = require(__dirname + '/../../lib/data-types'),
  Sequelize = require('../../index');

describe(Support.getTestDialectTeaser('Utils'), () => {
  describe('removeCommentsFromFunctionString', () => {
    it('removes line comments at the start of a line', () => {
      const functionWithLineComments = function() {
        // noot noot
      };

      const string = functionWithLineComments.toString(),
        result = Utils.removeCommentsFromFunctionString(string);

      expect(result).not.to.match(/.*noot.*/);
    });

    it('removes lines comments in the middle of a line', () => {
      const functionWithLineComments = function() {
        console.log(1); // noot noot
      };

      const string = functionWithLineComments.toString(),
        result = Utils.removeCommentsFromFunctionString(string);

      expect(result).not.to.match(/.*noot.*/);
    });

    it('removes range comments', () => {
      const s = function() {
        console.log(1); /*
          noot noot
        */
        console.log(2); /*
          foo
        */
      }.toString();

      const result = Utils.removeCommentsFromFunctionString(s);

      expect(result).not.to.match(/.*noot.*/);
      expect(result).not.to.match(/.*foo.*/);
      expect(result).to.match(/.*console.log\(2\).*/);
    });
  });

  describe('argsArePrimaryKeys', () => {
    it('doesn\'t detect primary keys if primareyKeys and values have different lengths', () => {
      expect(Utils.argsArePrimaryKeys([1, 2, 3], [1])).to.be.false;
    });

    it('doesn\'t detect primary keys if primary keys are hashes or arrays', () => {
      expect(Utils.argsArePrimaryKeys([[]], [1])).to.be.false;
    });

    it('detects primary keys if length is correct and data types are matching', () => {
      expect(Utils.argsArePrimaryKeys([1, 2, 3], ['INTEGER', 'INTEGER', 'INTEGER'])).to.be.true;
    });

    it('detects primary keys if primary keys are dates and lengths are matching', () => {
      expect(Utils.argsArePrimaryKeys([new Date()], ['foo'])).to.be.true;
    });
  });

  describe('underscore', () => {
    describe('underscoredIf', () => {
      it('is defined', () => {
        expect(Utils.underscoredIf).to.be.ok;
      });

      it('underscores if second param is true', () => {
        expect(Utils.underscoredIf('fooBar', true)).to.equal('foo_bar');
      });

      it('doesn\'t underscore if second param is false', () => {
        expect(Utils.underscoredIf('fooBar', false)).to.equal('fooBar');
      });
    });

    describe('camelizeIf', () => {
      it('is defined', () => {
        expect(Utils.camelizeIf).to.be.ok;
      });

      it('camelizes if second param is true', () => {
        expect(Utils.camelizeIf('foo_bar', true)).to.equal('fooBar');
      });

      it('doesn\'t camelize if second param is false', () => {
        expect(Utils.underscoredIf('fooBar', true)).to.equal('foo_bar');
      });
    });
  });

  describe('format', () => {
    it('should format where clause correctly when the value is truthy', () => {
      const where = ['foo = ?', 1];
      expect(Utils.format(where)).to.equal('foo = 1');
    });

    it('should format where clause correctly when the value is false', () => {
      const where = ['foo = ?', 0];
      expect(Utils.format(where)).to.equal('foo = 0');
    });
  });

  describe('cloneDeep', () => {
    it('should clone objects', () => {
      const obj = {foo: 1},
        clone = Utils.cloneDeep(obj);

      expect(obj).to.not.equal(clone);
    });

    it('should clone nested objects', () => {
      const obj = {foo: {bar: 1}},
        clone = Utils.cloneDeep(obj);

      expect(obj.foo).to.not.equal(clone.foo);
    });

    it('should not call clone methods on plain objects', () => {
      expect(() => {
        Utils.cloneDeep({
          clone() {
            throw new Error('clone method called');
          }
        });
      }).to.not.throw();
    });

    it('should not call clone methods on arrays', () => {
      expect(() => {
        const arr = [];
        arr.clone = function() {
          throw new Error('clone method called');
        };

        Utils.cloneDeep(arr);
      }).to.not.throw();
    });
  });

  describe('validateParameter', () => {
    describe('method signature', () => {
      it('throws an error if the value is not defined', () => {
        expect(() => {
          Utils.validateParameter();
        }).to.throw('No value has been passed.');
      });

      it('does not throw an error if the value is not defined and the parameter is optional', () => {
        expect(() => {
          Utils.validateParameter(undefined, Object, { optional: true });
        }).to.not.throw();
      });

      it('throws an error if the expectation is not defined', () => {
        expect(() => {
          Utils.validateParameter(1);
        }).to.throw('No expectation has been passed.');
      });
    });

    describe('expectation', () => {
      it('uses the instanceof method if the expectation is a class', () => {
        expect(Utils.validateParameter(new Number(1), Number)).to.be.true;
      });
    });

    describe('failing expectations', () => {
      it('throws an error if the expectation does not match', () => {
        expect(() => {
          Utils.validateParameter(1, String);
        }).to.throw(/The parameter.*is no.*/);
      });
    });
  });

  if (Support.getTestDialect() === 'postgres') {
    describe('json', () => {
      const queryGenerator = require('../../lib/dialects/postgres/query-generator.js');

      it('successfully parses a complex nested condition hash', () => {
        const conditions = {
          metadata: {
            language: 'icelandic',
            pg_rating: { 'dk': 'G' }
          },
          another_json_field: { x: 1 }
        };
        const expected = '("metadata"#>>\'{language}\') = \'icelandic\' AND ("metadata"#>>\'{pg_rating,dk}\') = \'G\' AND ("another_json_field"#>>\'{x}\') = \'1\'';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(conditions))).to.deep.equal(expected);
      });

      it('successfully parses a string using dot notation', () => {
        const path = 'metadata.pg_rating.dk';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal('("metadata"#>>\'{pg_rating,dk}\')');
      });

      it('allows postgres json syntax', () => {
        const path = 'metadata->pg_rating->>dk';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal(path);
      });

      it('can take a value to compare against', () => {
        const path = 'metadata.pg_rating.is';
        const value = 'U';
        expect(queryGenerator.handleSequelizeMethod(new Utils.Json(path, value))).to.equal('("metadata"#>>\'{pg_rating,is}\') = \'U\'');
      });
    });
  }

  describe('inflection', () => {
    it('works better than lingo ;)', () => {
      expect(Utils.pluralize('buy')).to.equal('buys');
      expect(Utils.pluralize('holiday')).to.equal('holidays');
      expect(Utils.pluralize('days')).to.equal('days');
      expect(Utils.pluralize('status')).to.equal('statuses');

      expect(Utils.singularize('status')).to.equal('status');
    });
  });

  describe('Sequelize.fn', () => {
    let Airplane;

    beforeEach(function() {
      Airplane = this.sequelize.define('Airplane', {
        wings: DataTypes.INTEGER,
        engines: DataTypes.INTEGER
      });

      return Airplane.sync({ force: true }).then(() => {
        return Airplane.bulkCreate([
          {
            wings: 2,
            engines: 0
          }, {
            wings: 4,
            engines: 1
          }, {
            wings: 2,
            engines: 2
          }
        ]);
      });
    });

    if (Support.getTestDialect() !== 'mssql') {
      it('accepts condition object (with cast)', function() {
        const type = Support.getTestDialect() === 'mysql' ? 'unsigned': 'int';

        return Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', Sequelize.cast({
              engines: 1
            }, type)), 'count-engines'],
            [Sequelize.fn('SUM', Sequelize.cast({
              $or: {
                engines: {
                  $gt: 1
                },
                wings: 4
              }
            }, type)), 'count-engines-wings']
          ]
        }).spread(airplane => {
          expect(parseInt(airplane.get('count'))).to.equal(3);
          expect(parseInt(airplane.get('count-engines'))).to.equal(1);
          expect(parseInt(airplane.get('count-engines-wings'))).to.equal(2);
        });
      });
    }

    if (Support.getTestDialect() !== 'mssql' && Support.getTestDialect() !== 'postgres') {
      it('accepts condition object (auto casting)', function() {
        return Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', {
              engines: 1
            }), 'count-engines'],
            [Sequelize.fn('SUM', {
              $or: {
                engines: {
                  $gt: 1
                },
                wings: 4
              }
            }), 'count-engines-wings']
          ]
        }).spread(airplane => {
          expect(parseInt(airplane.get('count'))).to.equal(3);
          expect(parseInt(airplane.get('count-engines'))).to.equal(1);
          expect(parseInt(airplane.get('count-engines-wings'))).to.equal(2);
        });
      });
    }
  });
});
