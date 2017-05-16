'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAll', () => {
    describe('order', () => {
      describe('Sequelize.literal()', () => {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            email: DataTypes.STRING
          });

          return this.User.sync({force: true}).bind(this).then(function() {
            return this.User.create({
              email: 'test@sequelizejs.com'
            });
          });
        });

        if (current.dialect.name !== 'mssql') {
          it('should work with order: literal()', function() {
            return this.User.findAll({
              order: this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))
            }).then(users => {
              expect(users.length).to.equal(1);
              users.forEach(user => {
                expect(user.get('email')).to.be.ok;
              });
            });
          });

          it('should work with order: [literal()]', function() {
            return this.User.findAll({
              order: [this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))]
            }).then(users => {
              expect(users.length).to.equal(1);
              users.forEach(user => {
                expect(user.get('email')).to.be.ok;
              });
            });
          });

          it('should work with order: [[literal()]]', function() {
            return this.User.findAll({
              order: [
                [this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))]
              ]
            }).then(users => {
              expect(users.length).to.equal(1);
              users.forEach(user => {
                expect(user.get('email')).to.be.ok;
              });
            });
          });
        }
      });

      describe('injections', () => {
        beforeEach(function() {
          this.User = this.sequelize.define('user', {
            name: DataTypes.STRING
          });
          this.Group = this.sequelize.define('group', {

          });
          this.User.belongsTo(this.Group);
          return this.sequelize.sync({force: true});
        });

        if (current.dialect.supports['ORDER NULLS']) {
          it('should not throw with on NULLS LAST/NULLS FIRST', function() {
            return this.User.findAll({
              include: [this.Group],
              order: [
                ['id', 'ASC NULLS LAST'],
                [this.Group, 'id', 'DESC NULLS FIRST']
              ]
            });
          });
        }

        it('should not throw on a literal', function() {
          return this.User.findAll({
            order: [
              ['id', this.sequelize.literal('ASC, name DESC')]
            ]
          });
        });

        it('should not throw with include when last order argument is a field', function() {
          return this.User.findAll({
            include: [this.Group],
            order: [
              [this.Group, 'id']
            ]
          });
        });
      });
    });
  });
});
