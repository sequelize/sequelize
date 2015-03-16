'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , dialect = Support.getTestDialect()
  , Promise = require(__dirname + '/../../lib/promise')
  , Transaction = require(__dirname + '/../../lib/transaction')
  , sinon = require('sinon')
  , current = Support.sequelize;

if (current.dialect.supports.transactions) {

describe(Support.getTestDialectTeaser('Transaction'), function() {
  this.timeout(4000);
  describe('constructor', function() {
    it('stores options', function() {
      var transaction = new Transaction(this.sequelize);
      expect(transaction.options).to.be.an.instanceOf(Object);
    });

    it('generates an identifier', function() {
      var transaction = new Transaction(this.sequelize);
      expect(transaction.id).to.exist;
    });
  });

  describe('commit', function() {
    it('is a commit method available', function() {
      expect(Transaction).to.respondTo('commit');
    });
  });

  describe('rollback', function() {
    it('is a rollback method available', function() {
      expect(Transaction).to.respondTo('rollback');
    });
  });

  describe('autoCallback', function() {
    it('supports automatically committing', function() {
      return this.sequelize.transaction(function(t) {
        return Promise.resolve();
      });
    });
    it('supports automatically rolling back with a thrown error', function() {
      return expect(this.sequelize.transaction(function(t) {
        throw new Error('Yolo');
      })).to.eventually.be.rejected;
    });
    it('supports automatically rolling back with a rejection', function() {
      return expect(this.sequelize.transaction(function(t) {
        return Promise.reject('Swag');
      })).to.eventually.be.rejected;
    });
    it('errors when no promise chain is returned', function() {
      return expect(this.sequelize.transaction(function(t) {

      })).to.eventually.be.rejected;
    });
  });

  it('does not allow queries after commit', function() {
    var self = this;
    return expect(
      this.sequelize.transaction().then(function(t) {
        return self.sequelize.query('SELECT 1+1', null, {transaction: t, raw: true}).then(function() {
          return t.commit();
        }).then(function() {
          return self.sequelize.query('SELECT 1+1', null, {transaction: t, raw: true});
        });
      })
    ).to.eventually.be.rejected;
  });

  it('does not allow queries after rollback', function() {
    var self = this;
    return expect(
      this.sequelize.transaction().then(function(t) {
        return self.sequelize.query('SELECT 1+1', null, {transaction: t, raw: true}).then(function() {
          return t.commit();
        }).then(function() {
          return self.sequelize.query('SELECT 1+1', null, {transaction: t, raw: true});
        });
      })
    ).to.eventually.be.rejected;
  });

  if (dialect === 'sqlite'){
    it('provides persistent transactions', function () {
      var sequelize = new Support.Sequelize('database', 'username', 'password', {dialect: 'sqlite'}),
          User = sequelize.define('user', {
            username: Support.Sequelize.STRING,
            awesome: Support.Sequelize.BOOLEAN
          });

      return sequelize.transaction()
        .then(function(t) {
          return sequelize.sync({transaction:t})
            .then(function( ) {
              return t;
            });
        })
        .then(function(t) {
          return User.create({}, {transaction:t})
            .then(function( ) {
              t.commit();
            });
        })
        .then(function( ) {
          return sequelize.transaction();
        })
        .then(function(t) {
          return User.findAll({}, {transaction:t});
        })
        .then(function(users) {
          return expect(users.length).to.equal(1);
        });
    });
  }

   if (current.dialect.supports.lock) {
    describe('row locking', function () {
      it('supports for update', function() {
        var User = this.sequelize.define('user', {
            username: Support.Sequelize.STRING,
            awesome: Support.Sequelize.BOOLEAN
          })
          , self = this
          , t1Spy = sinon.spy()
          , t2Spy = sinon.spy();

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({ username: 'jan'});
        }).then(function() {
          return self.sequelize.transaction().then(function(t1) {
            return User.find({
              where: {
                username: 'jan'
              }
            }, {
              lock: t1.LOCK.UPDATE,
              transaction: t1
            }).then(function(t1Jan) {
              return self.sequelize.transaction({
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
              }).then(function(t2) {
                return Promise.join(
                  User.find({
                    where: {
                      username: 'jan'
                    }
                  }, {
                    lock: t2.LOCK.UPDATE,
                    transaction: t2
                  }).then(function() {
                    t2Spy();
                    return t2.commit().then(function() {
                      expect(t2Spy).to.have.been.calledAfter(t1Spy); // Find should not succeed before t1 has comitted
                    });
                  }),

                  t1Jan.updateAttributes({
                    awesome: true
                  }, { transaction: t1}).then(function() {
                    t1Spy();
                    Promise.delay(2000).then(function () {
                      return t1.commit();
                    });
                  })
                );
              });
            });
          });
        });
      });

      it('supports for share', function() {
        var User = this.sequelize.define('user', {
            username: Support.Sequelize.STRING,
            awesome: Support.Sequelize.BOOLEAN
          })
          , self = this
          , t1Spy = sinon.spy()
          , t2FindSpy = sinon.spy()
          , t2UpdateSpy = sinon.spy();

        return this.sequelize.sync({ force: true }).then(function() {
          return User.create({ username: 'jan'});
        }).then(function() {
          return self.sequelize.transaction().then(function(t1) {
            return User.find({
              where: {
                username: 'jan'
              }
            }, {
              lock: t1.LOCK.SHARE,
              transaction: t1
            }).then(function(t1Jan) {
              return self.sequelize.transaction({
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
              }).then(function(t2) {
                return Promise.join(
                  User.find({
                    where: {
                      username: 'jan'
                    }
                  }, { transaction: t2}).then(function(t2Jan) {
                    t2FindSpy();

                    return t2Jan.updateAttributes({
                      awesome: false
                    }, {
                      transaction: t2
                    }).then(function() {
                      t2UpdateSpy();
                      return t2.commit().then(function() {
                        expect(t2FindSpy).to.have.been.calledBefore(t1Spy); // The find call should have returned
                        expect(t2UpdateSpy).to.have.been.calledAfter(t1Spy); // But the update call should not happen before the first transaction has committed
                      });
                    });
                  }),

                  t1Jan.updateAttributes({
                    awesome: true
                  }, {
                    transaction: t1
                  }).then(function() {
                    return Promise.delay(2000).then(function () {
                      t1Spy();
                      return t1.commit();
                    });
                  })
                );
              });
            });
          });
        });
      });
    });
  }
});

}
