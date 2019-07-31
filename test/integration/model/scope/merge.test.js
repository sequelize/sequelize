'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require('../../support'),
  combinatorics = require('js-combinatorics');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('simple merge', () => {
      beforeEach(function() {

        this.Foo = this.sequelize.define('foo', { name: Sequelize.STRING }, { timestamps: false });
        this.Bar = this.sequelize.define('bar', { name: Sequelize.STRING }, { timestamps: false });
        this.Baz = this.sequelize.define('baz', { name: Sequelize.STRING }, { timestamps: false });

        this.Foo.belongsTo(this.Baz, { foreignKey: 'bazId' });
        this.Foo.hasOne(this.Bar, { foreignKey: 'fooId' });

        this.createEntries = () => {
          return this.Baz.create({ name: 'The Baz' })
            .then(baz => this.Foo.create({ name: 'The Foo', bazId: baz.id }))
            .then(foo => this.Bar.create({ name: 'The Bar', fooId: foo.id }));
        };

        this.scopes = {
          includeBar: { include: this.Bar },
          includeBaz: { include: this.Baz }
        };

        this.Foo.addScope('includeBar', this.scopes.includeBar);
        this.Foo.addScope('includeBaz', this.scopes.includeBaz);

        return this.sequelize.sync({ force: true }).then(this.createEntries);

      });

      it('should merge simple scopes correctly', function() {
        return this.Foo.scope('includeBar', 'includeBaz').findOne().then(result => {
          const json = result.toJSON();
          expect(json.bar).to.be.ok;
          expect(json.baz).to.be.ok;
          expect(json.bar.name).to.equal('The Bar');
          expect(json.baz.name).to.equal('The Baz');
        });
      });

    });
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
