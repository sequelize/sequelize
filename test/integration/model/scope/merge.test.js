'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require('../../support'),
  combinatorics = require('js-combinatorics');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('complex merge', () => {
      beforeEach(function() {

        this.Foo = this.sequelize.define('foo', { name: Sequelize.STRING }, { timestamps: false });
        this.Bar = this.sequelize.define('bar', { name: Sequelize.STRING }, { timestamps: false });
        this.Baz = this.sequelize.define('baz', { name: Sequelize.STRING }, { timestamps: false });
        this.Qux = this.sequelize.define('qux', { name: Sequelize.STRING }, { timestamps: false });

        this.Foo.hasMany(this.Bar, { foreignKey: 'fooId' });
        this.Bar.hasMany(this.Baz, { foreignKey: 'barId' });
        this.Baz.hasMany(this.Qux, { foreignKey: 'bazId' });

        this.createFooWithDescendants = () => this.Foo.create({
          name: 'foo1',
          bars: [{
            name: 'bar1',
            bazs: [{
              name: 'baz1',
              quxes: [{ name: 'qux1' }, { name: 'qux2' }]
            }, {
              name: 'baz2',
              quxes: [{ name: 'qux3' }, { name: 'qux4' }]
            }]
          }, {
            name: 'bar2',
            bazs: [{
              name: 'baz3',
              quxes: [{ name: 'qux5' }, { name: 'qux6' }]
            }, {
              name: 'baz4',
              quxes: [{ name: 'qux7' }, { name: 'qux8' }]
            }]
          }]
        }, {
          include: [{
            model: this.Bar,
            include: [{
              model: this.Baz,
              include: [{
                model: this.Qux
              }]
            }]
          }]
        });

        this.scopes = {
          includeEverything: {
            include: {
              model: this.Bar,
              include: [{
                model: this.Baz,
                include: this.Qux
              }]
            }
          },
          limitedBars: {
            include: [{
              model: this.Bar,
              limit: 2
            }]
          },
          limitedBazs: {
            include: [{
              model: this.Bar,
              include: [{
                model: this.Baz,
                limit: 2
              }]
            }]
          },
          excludeBazName: {
            include: [{
              model: this.Bar,
              include: [{
                model: this.Baz,
                attributes: {
                  exclude: ['name']
                }
              }]
            }]
          }
        };

        this.Foo.addScope('includeEverything', this.scopes.includeEverything);
        this.Foo.addScope('limitedBars', this.scopes.limitedBars);
        this.Foo.addScope('limitedBazs', this.scopes.limitedBazs);
        this.Foo.addScope('excludeBazName', this.scopes.excludeBazName);

        this.scopePermutations = combinatorics.permutation([
          'includeEverything',
          'limitedBars',
          'limitedBazs',
          'excludeBazName'
        ]).toArray();

        return this.sequelize.sync({ force: true }).then(this.createFooWithDescendants);

      });

      it('should merge complex scopes correctly regardless of their order', function() {
        return Promise.map(this.scopePermutations, scopes => this.Foo.scope(...scopes).findOne()).then(results => {
          const first = results.shift().toJSON();
          for (const result of results) {
            expect(result.toJSON()).to.deep.equal(first);
          }
        });
      });

      it('should merge complex scopes with findAll options correctly regardless of their order', function() {
        return Promise.map(this.scopePermutations, ([a, b, c, d]) => this.Foo.scope(a, b, c).findAll(this.scopes[d]).then(x => x[0])).then(results => {
          const first = results.shift().toJSON();
          for (const result of results) {
            expect(result.toJSON()).to.deep.equal(first);
          }
        });
      });

      it('should merge complex scopes with findOne options correctly regardless of their order', function() {
        return Promise.map(this.scopePermutations, ([a, b, c, d]) => this.Foo.scope(a, b, c).findOne(this.scopes[d])).then(results => {
          const first = results.shift().toJSON();
          for (const result of results) {
            expect(result.toJSON()).to.deep.equal(first);
          }
        });
      });

    });
  });
});
