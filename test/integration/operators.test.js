'use strict';

const chai = require('chai');
const Sequelize = require('../../index');
const Op = Sequelize.Op;
const Promise = Sequelize.Promise;
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../lib/data-types');

describe(Support.getTestDialectTeaser('Operators'), () => {
  describe('REGEXP', () => {
    beforeEach(function () {
      this.User = this.sequelize.define(
        'user',
        {
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
        },
        {
          tableName: 'users',
          timestamps: false
        }
      );

      return Promise.all([
        this.sequelize.getQueryInterface().createTable('users', {
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
          },
          full_name: {
            type: DataTypes.STRING
          }
        })
      ]);
    });

    describe('case sensitive', () => {
      it('should work with a regexp where', function () {
        return this.User.create({
          name: 'Foobar'
        })
          .then(() => {
            return this.User.find({
              where: {
                name: {
                  [Op.regexp]: '^Foo'
                }
              }
            });
          })
          .then((user) => {
            expect(user).to.be.ok;
          });
      });

      it('should work with a not regexp where', function () {
        return this.User.create({
          name: 'Foobar'
        })
          .then(() => {
            return this.User.find({
              where: {
                name: {
                  [Op.notRegexp]: '^Foo'
                }
              }
            });
          })
          .then((user) => {
            expect(user).to.not.be.ok;
          });
      });

      it('should properly escape regular expressions', function () {
        return this.User.bulkCreate([
          {
            name: 'John'
          },
          {
            name: 'Bob'
          }
        ])
          .then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.notRegexp]: "Bob'; drop table users --"
                }
              }
            });
          })
          .then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.regexp]: "Bob'; drop table users --"
                }
              }
            });
          })
          .then(() => {
            return this.User.findAll();
          })
          .then((users) => {
            expect(users).length(2);
          });
      });
    });

    describe('case insensitive', () => {
      it('should work with a case-insensitive regexp where', function () {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        })
          .then(() => {
            return self.User.find({
              where: {
                name: {
                  [Op.iRegexp]: '^foo'
                }
              }
            });
          })
          .then((user) => {
            expect(user).to.be.ok;
          });
      });

      it('should work with a case-insensitive not regexp where', function () {
        const self = this;

        return this.User.create({
          name: 'Foobar'
        })
          .then(() => {
            return self.User.find({
              where: {
                name: {
                  [Op.notIRegexp]: '^foo'
                }
              }
            });
          })
          .then((user) => {
            expect(user).to.not.be.ok;
          });
      });

      it('should properly escape regular expressions', function () {
        return this.User.bulkCreate([
          {
            name: 'John'
          },
          {
            name: 'Bob'
          }
        ])
          .then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.iRegexp]: "Bob'; drop table users --"
                }
              }
            });
          })
          .then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.notIRegexp]: "Bob'; drop table users --"
                }
              }
            });
          })
          .then(() => {
            return this.User.findAll();
          })
          .then((users) => {
            expect(users).length(2);
          });
      });
    });
  });
});
