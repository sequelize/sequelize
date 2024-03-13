'use strict';

const chai = require('chai');
const { DataTypes } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('simple merge', () => {
      beforeEach(async function () {
        this.Foo = this.sequelize.define('foo', { name: DataTypes.STRING }, { timestamps: false });
        this.Bar = this.sequelize.define('bar', { name: DataTypes.STRING }, { timestamps: false });
        this.Baz = this.sequelize.define('baz', { name: DataTypes.STRING }, { timestamps: false });

        this.Foo.belongsTo(this.Baz, { foreignKey: 'bazId' });
        this.Foo.hasOne(this.Bar, { foreignKey: 'fooId' });

        this.createEntries = async () => {
          const baz = await this.Baz.create({ name: 'The Baz' });
          const foo = await this.Foo.create({ name: 'The Foo', bazId: baz.id });

          return this.Bar.create({ name: 'The Bar', fooId: foo.id });
        };

        this.scopes = {
          includeBar: { include: this.Bar },
          includeBaz: { include: this.Baz },
        };

        this.Foo.addScope('includeBar', this.scopes.includeBar);
        this.Foo.addScope('includeBaz', this.scopes.includeBaz);

        await this.createEntries(await this.sequelize.sync({ force: true }));
      });

      it('should merge simple scopes correctly', async function () {
        const result = await this.Foo.withScope('includeBar', 'includeBaz').findOne();
        const json = result.toJSON();
        expect(json.bar).to.be.ok;
        expect(json.baz).to.be.ok;
        expect(json.bar.name).to.equal('The Bar');
        expect(json.baz.name).to.equal('The Baz');
      });
    });
    describe('complex merge', () => {
      beforeEach(async function () {
        this.Foo = this.sequelize.define('foo', { name: DataTypes.STRING }, { timestamps: false });
        this.Bar = this.sequelize.define('bar', { name: DataTypes.STRING }, { timestamps: false });
        this.Baz = this.sequelize.define('baz', { name: DataTypes.STRING }, { timestamps: false });
        this.Qux = this.sequelize.define('qux', { name: DataTypes.STRING }, { timestamps: false });

        this.Foo.hasMany(this.Bar, { foreignKey: 'fooId' });
        this.Bar.hasMany(this.Baz, { foreignKey: 'barId' });
        this.Baz.hasMany(this.Qux, { foreignKey: 'bazId' });

        this.createFooWithDescendants = () =>
          this.Foo.create(
            {
              name: 'foo1',
              bars: [
                {
                  name: 'bar1',
                  bazs: [
                    {
                      name: 'baz1',
                      quxes: [{ name: 'qux1' }, { name: 'qux2' }],
                    },
                    {
                      name: 'baz2',
                      quxes: [{ name: 'qux3' }, { name: 'qux4' }],
                    },
                  ],
                },
                {
                  name: 'bar2',
                  bazs: [
                    {
                      name: 'baz3',
                      quxes: [{ name: 'qux5' }, { name: 'qux6' }],
                    },
                    {
                      name: 'baz4',
                      quxes: [{ name: 'qux7' }, { name: 'qux8' }],
                    },
                  ],
                },
              ],
            },
            {
              include: [
                {
                  model: this.Bar,
                  include: [
                    {
                      model: this.Baz,
                      include: [
                        {
                          model: this.Qux,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          );

        this.scopes = {
          includeEverything: {
            include: {
              model: this.Bar,
              include: [
                {
                  model: this.Baz,
                  include: this.Qux,
                },
              ],
            },
          },
          limitedBars: {
            include: [
              {
                model: this.Bar,
                limit: 2,
              },
            ],
          },
          limitedBazs: {
            include: [
              {
                model: this.Bar,
                include: [
                  {
                    model: this.Baz,
                    limit: 2,
                  },
                ],
              },
            ],
          },
          excludeBazName: {
            include: [
              {
                model: this.Bar,
                include: [
                  {
                    model: this.Baz,
                    attributes: {
                      exclude: ['name'],
                    },
                  },
                ],
              },
            ],
          },
        };

        this.Foo.addScope('includeEverything', this.scopes.includeEverything);
        this.Foo.addScope('limitedBars', this.scopes.limitedBars);
        this.Foo.addScope('limitedBazs', this.scopes.limitedBazs);
        this.Foo.addScope('excludeBazName', this.scopes.excludeBazName);

        this.scopePermutations = [
          ['includeEverything', 'limitedBars', 'limitedBazs', 'excludeBazName'],
          ['includeEverything', 'limitedBars', 'excludeBazName', 'limitedBazs'],
          ['includeEverything', 'limitedBazs', 'limitedBars', 'excludeBazName'],
          ['includeEverything', 'limitedBazs', 'excludeBazName', 'limitedBars'],
          ['includeEverything', 'excludeBazName', 'limitedBars', 'limitedBazs'],
          ['includeEverything', 'excludeBazName', 'limitedBazs', 'limitedBars'],
          ['limitedBars', 'includeEverything', 'limitedBazs', 'excludeBazName'],
          ['limitedBars', 'includeEverything', 'excludeBazName', 'limitedBazs'],
          ['limitedBars', 'limitedBazs', 'includeEverything', 'excludeBazName'],
          ['limitedBars', 'limitedBazs', 'excludeBazName', 'includeEverything'],
          ['limitedBars', 'excludeBazName', 'includeEverything', 'limitedBazs'],
          ['limitedBars', 'excludeBazName', 'limitedBazs', 'includeEverything'],
          ['limitedBazs', 'includeEverything', 'limitedBars', 'excludeBazName'],
          ['limitedBazs', 'includeEverything', 'excludeBazName', 'limitedBars'],
          ['limitedBazs', 'limitedBars', 'includeEverything', 'excludeBazName'],
          ['limitedBazs', 'limitedBars', 'excludeBazName', 'includeEverything'],
          ['limitedBazs', 'excludeBazName', 'includeEverything', 'limitedBars'],
          ['limitedBazs', 'excludeBazName', 'limitedBars', 'includeEverything'],
          ['excludeBazName', 'includeEverything', 'limitedBars', 'limitedBazs'],
          ['excludeBazName', 'includeEverything', 'limitedBazs', 'limitedBars'],
          ['excludeBazName', 'limitedBars', 'includeEverything', 'limitedBazs'],
          ['excludeBazName', 'limitedBars', 'limitedBazs', 'includeEverything'],
          ['excludeBazName', 'limitedBazs', 'includeEverything', 'limitedBars'],
          ['excludeBazName', 'limitedBazs', 'limitedBars', 'includeEverything'],
        ];

        await this.createFooWithDescendants(await this.sequelize.sync({ force: true }));
      });

      it('should merge complex scopes correctly regardless of their order', async function () {
        const results = await Promise.all(
          this.scopePermutations.map(scopes => this.Foo.withScope(...scopes).findOne()),
        );
        const first = results.shift().toJSON();
        for (const result of results) {
          expect(result.toJSON()).to.deep.equal(first);
        }
      });

      it('should merge complex scopes with findAll options correctly regardless of their order', async function () {
        const results = await Promise.all(
          this.scopePermutations.map(async ([a, b, c, d]) => {
            const x = await this.Foo.withScope(a, b, c).findAll(this.scopes[d]);

            return x[0];
          }),
        );

        const first = results.shift().toJSON();
        for (const result of results) {
          expect(result.toJSON()).to.deep.equal(first);
        }
      });

      it('should merge complex scopes with findOne options correctly regardless of their order', async function () {
        const results = await Promise.all(
          this.scopePermutations.map(([a, b, c, d]) =>
            this.Foo.withScope(a, b, c).findOne(this.scopes[d]),
          ),
        );
        const first = results.shift().toJSON();
        for (const result of results) {
          expect(result.toJSON()).to.deep.equal(first);
        }
      });
    });
  });
});
