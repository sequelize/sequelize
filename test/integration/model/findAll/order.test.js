'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('findAll', function () {
    describe('order', function () {
      it('should work on a model field whose name doesnt match the database, while offsetting and including a hasMany.', function() {
        var Foo = current.define('foo', {
          fooId: {
            field: 'foo_id',
            type: DataTypes.UUID,
            primaryKey: true
          },
          baseNumber: {
            field: 'base_number',
            type: DataTypes.STRING(25)
          }
        }, {
          timestamps: false
        }),
          Bar = current.define('bar', {
            barId: {
              field: 'bar_id',
              type: DataTypes.UUID,
              primaryKey: true
            },
            fooId: {
              field: 'foo_id',
              type: DataTypes.UUID,
              allowNull: false
            }
          }, {
            timestamps: false
          });

        Foo.hasMany(Bar, {foreignKey: 'foo_id', as: 'bars'});

        return current.sync({force: true})
          .then(function () {
            var options = {
              include: [
                {
                  model: Bar, as: 'bars'
                }
              ],
              offset: 0,
              limit: 50,
              order: [['base_number', 'ASC']]
            };

            return Foo.findAll(options).then(function () {
              console.log('success!');
            }, function (err) {
              throw err;
            });
          });
       });

      describe('Sequelize.literal()', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('User', {
            email: DataTypes.STRING
          });

          return this.User.sync({force: true}).bind(this).then(function () {
            return this.User.create({
              email: 'test@sequelizejs.com'
            });
          });
        });

        if (current.dialect.name !== 'mssql') {
          it('should work with order: literal()', function () {
            return this.User.findAll({
              order: this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))
            }).then(function (users) {
              expect(users.length).to.equal(1);
              users.forEach(function (user) {
                expect(user.get('email')).to.be.ok;
              });
            });
          });

          it('should work with order: [literal()]', function () {
            return this.User.findAll({
              order: [this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))]
            }).then(function (users) {
              expect(users.length).to.equal(1);
              users.forEach(function (user) {
                expect(user.get('email')).to.be.ok;
              });
            });
          });

          it('should work with order: [[literal()]]', function () {
            return this.User.findAll({
              order: [
                [this.sequelize.literal('email = ' + this.sequelize.escape('test@sequelizejs.com'))]
              ]
            }).then(function (users) {
              expect(users.length).to.equal(1);
              users.forEach(function (user) {
                expect(user.get('email')).to.be.ok;
              });
            });
          });
        }
      });

      describe('injections', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('user', {
            name: DataTypes.STRING
          });
          this.Group = this.sequelize.define('group', {

          });
          this.User.belongsTo(this.Group);
          return this.sequelize.sync({force: true});
        });

        it('should throw when 2nd order argument is not ASC or DESC', function () {
          return expect(this.User.findAll({
            order: [
              ['id', ';DELETE YOLO INJECTIONS']
            ]
          })).to.eventually.be.rejectedWith(Error, 'Order must be \'ASC\' or \'DESC\', \';DELETE YOLO INJECTIONS\' given');
        });

        it('should throw with include when last order argument is not ASC or DESC', function () {
          return expect(this.User.findAll({
            include: [this.Group],
            order: [
              [this.Group, 'id', ';DELETE YOLO INJECTIONS']
            ]
          })).to.eventually.be.rejectedWith(Error, 'Order must be \'ASC\' or \'DESC\', \';DELETE YOLO INJECTIONS\' given');
        });

        if (current.dialect.supports['ORDER NULLS']) {
          it('should not throw with on NULLS LAST/NULLS FIRST', function () {
            return this.User.findAll({
              include: [this.Group],
              order: [
                ['id', 'ASC NULLS LAST'],
                [this.Group, 'id', 'DESC NULLS FIRST']
              ]
            });
          });
        }

        it('should not throw on a literal', function () {
          return this.User.findAll({
            order: [
              ['id', this.sequelize.literal('ASC, name DESC')]
            ]
          });
        });

        it('should not throw with include when last order argument is a field', function () {
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
