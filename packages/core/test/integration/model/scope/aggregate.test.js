'use strict';

const chai = require('chai');
const { DataTypes, Op } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('scope', () => {
    describe('aggregate', () => {
      beforeEach(async function () {
        this.Child = this.sequelize.define('Child', {
          priority: DataTypes.INTEGER,
        });
        this.ScopeMe = this.sequelize.define(
          'ScopeMe',
          {
            username: DataTypes.STRING,
            email: DataTypes.STRING,
            access_level: DataTypes.INTEGER,
            other_value: DataTypes.INTEGER,
          },
          {
            defaultScope: {
              where: {
                access_level: {
                  [Op.gte]: 5,
                },
              },
            },
            scopes: {
              lowAccess: {
                where: {
                  access_level: {
                    [Op.lte]: 5,
                  },
                },
              },
              withOrder: {
                order: ['username'],
              },
              withInclude: {
                include: [
                  {
                    model: this.Child,
                    where: {
                      priority: 1,
                    },
                  },
                ],
              },
            },
          },
        );
        this.Child.belongsTo(this.ScopeMe);
        this.ScopeMe.hasMany(this.Child);

        await this.sequelize.sync({ force: true });
        const records0 = [
          { username: 'tony', email: 'tony@sequelizejs.com', access_level: 3, other_value: 7 },
          { username: 'tobi', email: 'tobi@fakeemail.com', access_level: 10, other_value: 11 },
          { username: 'dan', email: 'dan@sequelizejs.com', access_level: 5, other_value: 10 },
          { username: 'fred', email: 'fred@foobar.com', access_level: 3, other_value: 7 },
        ];
        await this.ScopeMe.bulkCreate(records0);
        const records = await this.ScopeMe.findAll();

        await Promise.all([
          records[0].createChild({
            priority: 1,
          }),
          records[1].createChild({
            priority: 2,
          }),
        ]);
      });

      it('should apply defaultScope', async function () {
        await expect(this.ScopeMe.aggregate('*', 'count')).to.eventually.equal(2);
      });

      it('should be able to override default scope', async function () {
        await expect(
          this.ScopeMe.aggregate('*', 'count', { where: { access_level: { [Op.gt]: 5 } } }),
        ).to.eventually.equal(1);
      });

      it('returns null when calling sum on an empty result set', async function () {
        await expect(
          this.ScopeMe.aggregate('access_level', 'sum', {
            where: { access_level: { [Op.gt]: 42 } },
          }),
        ).to.eventually.equal(null);
      });

      it('returns null when calling min on an empty result set', async function () {
        await expect(
          this.ScopeMe.aggregate('access_level', 'min', {
            where: { access_level: { [Op.gt]: 42 } },
          }),
        ).to.eventually.equal(null);
      });

      it('returns null when calling max on an empty result set', async function () {
        await expect(
          this.ScopeMe.aggregate('access_level', 'max', {
            where: { access_level: { [Op.gt]: 42 } },
          }),
        ).to.eventually.equal(null);
      });

      it('should be able to unscope', async function () {
        await expect(this.ScopeMe.withoutScope().aggregate('*', 'count')).to.eventually.equal(4);
      });

      it('should be able to apply other scopes', async function () {
        await expect(
          this.ScopeMe.withScope('lowAccess').aggregate('*', 'count'),
        ).to.eventually.equal(3);
      });

      it('should be able to merge scopes with where', async function () {
        await expect(
          this.ScopeMe.withScope('lowAccess').aggregate('*', 'count', {
            where: { username: 'dan' },
          }),
        ).to.eventually.equal(1);
      });

      it('should be able to use where on include', async function () {
        await expect(
          this.ScopeMe.withScope('withInclude').aggregate('ScopeMe.id', 'count', {
            plain: true,
            dataType: new DataTypes.INTEGER(),
            includeIgnoreAttributes: false,
            limit: null,
            offset: null,
            order: null,
            attributes: [],
          }),
        ).to.eventually.equal(1);
      });

      if (Support.sequelize.dialect.supports.schemas) {
        it('aggregate with schema', async function () {
          this.Hero = this.sequelize.define(
            'Hero',
            {
              codename: DataTypes.STRING,
            },
            { schema: 'heroschema' },
          );
          await this.sequelize.createSchema('heroschema');
          await this.sequelize.sync({ force: true });
          const records = [{ codename: 'hulk' }, { codename: 'rantanplan' }];
          await this.Hero.bulkCreate(records);

          await expect(
            this.Hero.withoutScope().aggregate('*', 'count', { schema: 'heroschema' }),
          ).to.eventually.equal(2);
        });
      }
    });
  });
});
