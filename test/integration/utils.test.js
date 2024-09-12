'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Utils = require('sequelize/lib/utils'),
  Support = require('./support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op;

describe(Support.getTestDialectTeaser('Utils'), () => {
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
      const obj = { foo: 1 },
        clone = Utils.cloneDeep(obj);

      expect(obj).to.not.equal(clone);
    });

    it('should clone nested objects', () => {
      const obj = { foo: { bar: 1 } },
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

  if (Support.getTestDialect() === 'postgres') {
    describe('json', () => {
      beforeEach(function() {
        this.queryGenerator = this.sequelize.getQueryInterface().queryGenerator;
      });

      it('successfully parses a complex nested condition hash', function() {
        const conditions = {
          metadata: {
            language: 'icelandic',
            pg_rating: { 'dk': 'G' }
          },
          another_json_field: { x: 1 }
        };
        const expected = '("metadata"#>>\'{language}\') = \'icelandic\' AND ("metadata"#>>\'{pg_rating,dk}\') = \'G\' AND ("another_json_field"#>>\'{x}\') = \'1\'';
        expect(this.queryGenerator.handleSequelizeMethod(new Utils.Json(conditions))).to.deep.equal(expected);
      });

      it('successfully parses a string using dot notation', function() {
        const path = 'metadata.pg_rating.dk';
        expect(this.queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal('("metadata"#>>\'{pg_rating,dk}\')');
      });

      it('allows postgres json syntax', function() {
        const path = 'metadata->pg_rating->>dk';
        expect(this.queryGenerator.handleSequelizeMethod(new Utils.Json(path))).to.equal(path);
      });

      it('can take a value to compare against', function() {
        const path = 'metadata.pg_rating.is';
        const value = 'U';
        expect(this.queryGenerator.handleSequelizeMethod(new Utils.Json(path, value))).to.equal('("metadata"#>>\'{pg_rating,is}\') = \'U\'');
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

    beforeEach(async function() {
      Airplane = this.sequelize.define('Airplane', {
        wings: DataTypes.INTEGER,
        engines: DataTypes.INTEGER
      });

      await Airplane.sync({ force: true });

      await Airplane.bulkCreate([
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
    if (!['mssql', 'oracle'].includes(Support.getTestDialect())) {
      it('accepts condition object (with cast)', async function() {
        const type = Support.getTestDialect() === 'mysql' ? 'unsigned' : 'int';

        const [airplane] = await Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', Sequelize.cast({
              engines: 1
            }, type)), 'count-engines'],
            [Sequelize.fn('SUM', Sequelize.cast({
              [Op.or]: {
                engines: {
                  [Op.gt]: 1
                },
                wings: 4
              }
            }, type)), 'count-engines-wings']
          ]
        });

        // TODO: `parseInt` should not be needed, see #10533
        expect(parseInt(airplane.get('count'), 10)).to.equal(3);
        expect(parseInt(airplane.get('count-engines'), 10)).to.equal(1);
        expect(parseInt(airplane.get('count-engines-wings'), 10)).to.equal(2);
      });
    }

    if (!['mssql', 'postgres', 'oracle'].includes(Support.getTestDialect())) {
      it('accepts condition object (auto casting)', async function() {
        const [airplane] = await Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', {
              engines: 1
            }), 'count-engines'],
            [Sequelize.fn('SUM', {
              [Op.or]: {
                engines: {
                  [Op.gt]: 1
                },
                wings: 4
              }
            }), 'count-engines-wings']
          ]
        });

        // TODO: `parseInt` should not be needed, see #10533
        expect(airplane.get('count')).to.equal(3);
        expect(parseInt(airplane.get('count-engines'), 10)).to.equal(1);
        expect(parseInt(airplane.get('count-engines-wings'), 10)).to.equal(2);
      });
    }
  });

  describe('flattenObjectDeep', () => {
    it('should return the value if it is not an object', () => {
      const value = 'non-object';
      const returnedValue = Utils.flattenObjectDeep(value);
      expect(returnedValue).to.equal(value);
    });

    it('should return correctly if values are null', () => {
      const value = {
        name: 'John',
        address: {
          street: 'Fake St. 123',
          city: null,
          coordinates: {
            longitude: 55.6779627,
            latitude: 12.5964313
          }
        }
      };
      const returnedValue = Utils.flattenObjectDeep(value);
      expect(returnedValue).to.deep.equal({
        name: 'John',
        'address.street': 'Fake St. 123',
        'address.city': null,
        'address.coordinates.longitude': 55.6779627,
        'address.coordinates.latitude': 12.5964313
      });
    });
  });
});
