'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('../../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAll', () => {
    describe('order', () => {
      describe('Sequelize.literal()', () => {
        beforeEach(async function () {
          this.User = this.sequelize.define('User', {
            email: DataTypes.STRING
          });

          await this.User.sync({ force: true });

          await this.User.create({
            email: 'test@sequelizejs.com'
          });
        });

        if (current.dialect.name !== 'mssql') {
          it('should work with order: literal()', async function () {
            const users = await this.User.findAll({
              order: this.sequelize.literal(`email = ${this.sequelize.escape('test@sequelizejs.com')}`)
            });

            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.get('email')).to.be.ok;
            });
          });

          it('should work with order: [literal()]', async function () {
            const users = await this.User.findAll({
              order: [this.sequelize.literal(`email = ${this.sequelize.escape('test@sequelizejs.com')}`)]
            });

            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.get('email')).to.be.ok;
            });
          });

          it('should work with order: [[literal()]]', async function () {
            const users = await this.User.findAll({
              order: [[this.sequelize.literal(`email = ${this.sequelize.escape('test@sequelizejs.com')}`)]]
            });

            expect(users.length).to.equal(1);
            users.forEach(user => {
              expect(user.get('email')).to.be.ok;
            });
          });
        }
      });

      describe('injections', () => {
        beforeEach(async function () {
          this.User = this.sequelize.define('user', {
            name: DataTypes.STRING
          });
          this.Group = this.sequelize.define('group', {});
          this.User.belongsTo(this.Group);
          await this.sequelize.sync({ force: true });
        });

        if (current.dialect.supports['ORDER NULLS']) {
          it('should not throw with on NULLS LAST/NULLS FIRST', async function () {
            await this.User.findAll({
              include: [this.Group],
              order: [
                ['id', 'ASC NULLS LAST'],
                [this.Group, 'id', 'DESC NULLS FIRST']
              ]
            });
          });
        }

        it('should not throw on a literal', async function () {
          await this.User.findAll({
            order: [['id', this.sequelize.literal('ASC, name DESC')]]
          });
        });

        it('should not throw with include when last order argument is a field', async function () {
          await this.User.findAll({
            include: [this.Group],
            order: [[this.Group, 'id']]
          });
        });
      });
    });
  });
});
