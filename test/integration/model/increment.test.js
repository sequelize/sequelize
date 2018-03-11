'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Model'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  after(function() {
    this.clock.restore();
  });

  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      cNumber: { type: DataTypes.INTEGER, field: 'c_number'}
    });

    return this.User.sync({ force: true }).then(() => {
      return this.User.bulkCreate([{
        id: 1,
        aNumber: 0,
        bNumber: 0
      }, {
        id: 2,
        aNumber: 0,
        bNumber: 0
      }, {
        id: 3,
        aNumber: 0,
        bNumber: 0
      }, {
        id: 4,
        aNumber: 0,
        bNumber: 0,
        cNumber: 0
      }]);
    });
  });

  [
    'increment',
    'decrement'
  ].forEach(method => {
    describe(method, () => {
      before(function () {
        this.assert = (increment, decrement) => {
          return method === 'increment'  ? increment : decrement;
        };
      });

      it('supports where conditions', function() {
        return this.User.findById(1).then(() => {
          return this.User[method](['aNumber'], { by: 2, where: { id: 1 } }).then(() => {
            return this.User.findById(2).then(user3 => {
              expect(user3.aNumber).to.be.equal(this.assert(0, 0));
            });
          });
        });
      });

      it('uses correct column names for where conditions', function() {
        return this.User[method](['aNumber'], {by: 2, where: {cNumber: 0}}).then(() => {
          return this.User.findById(4).then(user4 => {
            expect(user4.aNumber).to.be.equal(this.assert(2, -2));
          });
        });
      });

      it('should still work right with other concurrent increments', function() {
        return this.User.findAll().then(aUsers => {
          return this.sequelize.Promise.all([
            this.User[method](['aNumber'], { by: 2, where: {} }),
            this.User[method](['aNumber'], { by: 2, where: {} }),
            this.User[method](['aNumber'], { by: 2, where: {} })
          ]).then(() => {
            return this.User.findAll().then(bUsers => {
              for (let i = 0; i < bUsers.length; i++) {
                expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 6, aUsers[i].aNumber - 6));
              }
            });
          });
        });
      });

      it('with array', function() {
        return this.User.findAll().then(aUsers => {
          return this.User[method](['aNumber'], { by: 2, where: {} }).then(() => {
            return this.User.findAll().then(bUsers => {
              for (let i = 0; i < bUsers.length; i++) {
                expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
              }
            });
          });
        });
      });

      it('with single field', function() {
        return this.User.findAll().then(aUsers => {
          return this.User[method]('aNumber', { by: 2, where: {} }).then(() => {
            return this.User.findAll().then(bUsers => {
              for (let i = 0; i < bUsers.length; i++) {
                expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
              }
            });
          });
        });
      });

      it('with single field and no value', function() {
        return this.User.findAll().then(aUsers => {
          return this.User[method]('aNumber', { where: {}}).then(() => {
            return this.User.findAll().then(bUsers => {
              for (let i = 0; i < bUsers.length; i++) {
                expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
              }
            });
          });
        });
      });

      it('with key value pair', function() {
        return this.User.findAll().then(aUsers => {
          return this.User[method]({ 'aNumber': 1, 'bNumber': 2 }, { where: { }}).then(() => {
            return this.User.findAll().then(bUsers => {
              for (let i = 0; i < bUsers.length; i++) {
                expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
                expect(bUsers[i].bNumber).to.equal(this.assert(aUsers[i].bNumber + 2, aUsers[i].bNumber - 2));
              }
            });
          });
        });
      });

      it('should still work right with other concurrent updates', function() {
        return this.User.findAll().then(aUsers => {
          return this.User.update({ 'aNumber': 2 }, { where: {} }).then(() => {
            return this.User[method](['aNumber'], { by: 2, where: {} }).then(() => {
              return this.User.findAll().then(bUsers => {
                for (let i = 0; i < bUsers.length; i++) {
                  // for decrement 2 - 2 = 0
                  expect(bUsers[i].aNumber).to.equal(this.assert(aUsers[i].aNumber + 4, aUsers[i].aNumber));
                }
              });
            });
          });
        });
      });

      it('with timestamps set to true', function() {
        const User = this.sequelize.define('IncrementUser', {
          aNumber: DataTypes.INTEGER
        }, { timestamps: true });
        let oldDate;

        return User.sync({ force: true }).bind(this).then(() => {
          return User.create({aNumber: 1});
        }).then(function(user) {
          oldDate = user.updatedAt;

          this.clock.tick(1000);
          return User[method]('aNumber', {by: 1, where: {}});
        }).then(() => {
          return expect(User.findById(1)).to.eventually.have.property('updatedAt').afterTime(oldDate);
        });
      });

      it('with timestamps set to true and options.silent set to true', function() {
        const User = this.sequelize.define('IncrementUser', {
          aNumber: DataTypes.INTEGER
        }, { timestamps: true });
        let oldDate;

        return User.sync({ force: true }).bind(this).then(() => {
          return User.create({aNumber: 1});
        }).then(function(user) {
          oldDate = user.updatedAt;
          this.clock.tick(1000);
          return User[method]('aNumber', {by: 1, silent: true, where: { }});
        }).then(() => {
          return expect(User.findById(1)).to.eventually.have.property('updatedAt').equalTime(oldDate);
        });
      });

      it('should work with scopes', function() {
        const User = this.sequelize.define('User', {
          aNumber: DataTypes.INTEGER,
          name: DataTypes.STRING
        }, {
          scopes: {
            jeff: {
              where: {
                name: 'Jeff'
              }
            }
          }
        });

        return User.sync({ force: true }).then(() => {
          return User.bulkCreate([
            {
              aNumber: 1,
              name: 'Jeff'
            },
            {
              aNumber: 3,
              name: 'Not Jeff'
            }
          ]);
        }).then(() => {
          return User.scope('jeff')[method]('aNumber', {});
        }).then(() => {
          return User.scope('jeff').findOne();
        }).then(jeff => {
          expect(jeff.aNumber).to.equal(this.assert(2, 0));
        }).then(() => {
          return User.findOne({
            where: {
              name: 'Not Jeff'
            }
          });
        }).then(notJeff => {
          expect(notJeff.aNumber).to.equal(this.assert(3, 3));
        });
      });
    });
  });
});
