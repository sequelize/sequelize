'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Operators'), () => {
  describe('REGEXP', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          field: 'userId'
        },
        name: {
          type: DataTypes.STRING,
          field: 'full_name'
        }
      }, {
        tableName: 'users',
        timestamps: false
      });

      await this.sequelize.getQueryInterface().createTable('users', {
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        full_name: {
          type: DataTypes.STRING
        }
      });
    });

    if (['mysql', 'postgres'].includes(dialect)) {
      describe('case sensitive', () => {
        it('should work with a regexp where', async function() {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.regexp]: '^Foo' }
            }
          });
          expect(user).to.be.ok;
        });

        it('should work with a not regexp where', async function() {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.notRegexp]: '^Foo' }
            }
          });
          expect(user).to.not.be.ok;
        });

        it('should properly escape regular expressions', async function() {
          await this.User.bulkCreate([{ name: 'John' }, { name: 'Bob' }]);
          await this.User.findAll({
            where: {
              name: { [Op.notRegexp]: "Bob'; drop table users --" }
            }
          });
          await this.User.findAll({
            where: {
              name: { [Op.regexp]: "Bob'; drop table users --" }
            }
          });
          expect(await this.User.findAll()).to.have.length(2);
        });
      });
    }

    if (dialect === 'postgres') {
      describe('case insensitive', () => {
        it('should work with a case-insensitive regexp where', async function() {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.iRegexp]: '^foo' }
            }
          });
          expect(user).to.be.ok;
        });

        it('should work with a case-insensitive not regexp where', async function() {
          await this.User.create({ name: 'Foobar' });
          const user = await this.User.findOne({
            where: {
              name: { [Op.notIRegexp]: '^foo' }
            }
          });
          expect(user).to.not.be.ok;
        });

        it('should properly escape regular expressions', async function() {
          await this.User.bulkCreate([{ name: 'John' }, { name: 'Bob' }]);
          await this.User.findAll({
            where: {
              name: { [Op.iRegexp]: "Bob'; drop table users --" }
            }
          });
          await this.User.findAll({
            where: {
              name: { [Op.notIRegexp]: "Bob'; drop table users --" }
            }
          });
          expect(await this.User.findAll()).to.have.length(2);
        });
      });
    }
  });
});
