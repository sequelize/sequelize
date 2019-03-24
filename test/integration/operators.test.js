'use strict';

const { stub } = require('sinon');
const { expect } = require('chai');
const Sequelize = require('../../index');
const Op = Sequelize.Op;
const Promise = Sequelize.Promise;
const Support = require('../support');
const DataTypes = require('../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Operators'), () => {
  describe('REGEXP', () => {
    beforeEach(function() {
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
        },
        json: {
          type: DataTypes.JSON
        }
      }, {
        tableName: 'users',
        timestamps: false
      });

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
          },
          json: {
            type: DataTypes.JSON
          }
        })
      ]);
    });

    if (dialect === 'mysql' || dialect === 'postgres') {
      describe('case sensitive', () => {
        it('should work with a regexp where', function() {
          return this.User.create({
            name: 'Foobar'
          }).then(() => {
            return this.User.findOne({
              where: {
                name: {
                  [Op.regexp]: '^Foo'
                }
              }
            });
          }).then(user => {
            expect(user).to.be.ok;
          });
        });

        it('should work with a not regexp where', function() {
          return this.User.create({
            name: 'Foobar'
          }).then(() => {
            return this.User.findOne({
              where: {
                name: {
                  [Op.notRegexp]: '^Foo'
                }
              }
            });
          }).then(user => {
            expect(user).to.not.be.ok;
          });
        });

        it('should work with json', function() {
          const logging = stub();
          return this.User.findOne({
            logging,
            where: {
              json: {
                [Op.regexp]: 'test'
              }
            }
          })
            .then(() => {
              expect(logging.firstCall.args[0]).to.not.include('\\"test\\"');
            });
        });

        it('should properly escape regular expressions', function() {
          return this.User.bulkCreate([{
            name: 'John'
          }, {
            name: 'Bob'
          }]).then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.notRegexp]: "Bob'; drop table users --"
                }
              }
            });
          }).then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.regexp]: "Bob'; drop table users --"
                }
              }
            });
          }).then(() => {
            return this.User.findAll();
          }).then(users => {
            expect(users).length(2);
          });
        });
      });
    }

    if (dialect === 'postgres') {
      describe('case insensitive', () => {
        it('should work with a case-insensitive regexp where', function() {
          return this.User.create({
            name: 'Foobar'
          }).then(() => {
            return this.User.findOne({
              where: {
                name: {
                  [Op.iRegexp]: '^foo'
                }
              }
            });
          }).then(user => {
            expect(user).to.be.ok;
          });
        });

        it('should work with a case-insensitive not regexp where', function() {
          return this.User.create({
            name: 'Foobar'
          }).then(() => {
            return this.User.findOne({
              where: {
                name: {
                  [Op.notIRegexp]: '^foo'
                }
              }
            });
          }).then(user => {
            expect(user).to.not.be.ok;
          });
        });

        it('should properly escape regular expressions', function() {
          return this.User.bulkCreate([{
            name: 'John'
          }, {
            name: 'Bob'
          }]).then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.iRegexp]: "Bob'; drop table users --"
                }
              }
            });
          }).then(() => {
            return this.User.findAll({
              where: {
                name: {
                  [Op.notIRegexp]: "Bob'; drop table users --"
                }
              }
            });
          }).then(() => {
            return this.User.findAll();
          }).then(users => {
            expect(users).length(2);
          });
        });
      });
    }
  });
});
