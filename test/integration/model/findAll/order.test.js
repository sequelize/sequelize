'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAll', () => {
    describe('order', () => {
      describe('Sequelize.literal()', () => {
        beforeEach(async function () {
          this.User = this.sequelize.define('User', {
            email: DataTypes.STRING,
          });

          await this.User.sync({ force: true });

          await this.User.create({
            email: 'test@sequelizejs.com',
          });
        });

        if (current.dialect.name !== 'mssql' && current.dialect.name !== 'ibmi') {
          const email = current.dialect.name === 'db2' ? '"email"' : 'email';
          it('should work with order: literal()', async function () {
            const users = await this.User.findAll({
              order: this.sequelize.literal(`${email} = ${this.sequelize.escape('test@sequelizejs.com')}`),
            });

            expect(users.length).to.equal(1);
            for (const user of users) {
              expect(user.get('email')).to.be.ok;
            }
          });

          it('should work with order: [literal()]', async function () {
            const users = await this.User.findAll({
              order: [this.sequelize.literal(`${email} = ${this.sequelize.escape('test@sequelizejs.com')}`)],
            });

            expect(users.length).to.equal(1);
            for (const user of users) {
              expect(user.get('email')).to.be.ok;
            }
          });

          it('should work with order: [[literal()]]', async function () {
            const users = await this.User.findAll({
              order: [
                [this.sequelize.literal(`${email} = ${this.sequelize.escape('test@sequelizejs.com')}`)],
              ],
            });

            expect(users.length).to.equal(1);
            for (const user of users) {
              expect(user.get('email')).to.be.ok;
            }
          });
        }
      });

      describe('injections', () => {
        beforeEach(async function () {
          this.User = this.sequelize.define('user', {
            name: DataTypes.STRING,
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
                [this.Group, 'id', 'DESC NULLS FIRST'],
              ],
            });
          });
        }

        it('should not throw on a literal', async function () {
          if (['db2', 'ibmi'].includes(current.dialect.name)) {
            await this.User.findAll({
              order: [
                ['id', this.sequelize.literal('ASC, "name" DESC')],
              ],
            });
          } else {
            await this.User.findAll({
              order: [
                ['id', this.sequelize.literal('ASC, name DESC')],
              ],
            });
          }
        });

        it('should not throw with include when last order argument is a field', async function () {
          await this.User.findAll({
            include: [this.Group],
            order: [
              [this.Group, 'id'],
            ],
          });
        });
      });
    });
  });
});
