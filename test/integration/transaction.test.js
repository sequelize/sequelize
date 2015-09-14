'use strict';

/* jshint -W030 */
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
  this.timeout(5000);
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
      return this.sequelize.transaction(function() {
        return Promise.resolve();
      });
    });

    it('supports automatically rolling back with a thrown error', function() {
      var t;
      return (expect(this.sequelize.transaction(function(transaction) {
        t = transaction;
        throw new Error('Yolo');
      })).to.eventually.be.rejected).then(function() {
        expect(t.finished).to.be.equal('rollback');
      });
    });

    it('supports automatically rolling back with a rejection', function() {
      var t;
      return (expect(this.sequelize.transaction(function(transaction) {
        t = transaction;
        return Promise.reject('Swag');
      })).to.eventually.be.rejected).then(function() {
        expect(t.finished).to.be.equal('rollback');
      });
    });

    it('errors when no promise chain is returned', function() {
      var t;
      return (expect(this.sequelize.transaction(function(transaction) {
        t = transaction;
      })).to.eventually.be.rejected).then(function() {
        expect(t.finished).to.be.equal('rollback');
      });
    });

    if (dialect === 'postgres' || dialect === 'mssql') {
      it('do not rollback if already committed', function() {
        var SumSumSum = this.sequelize.define('transaction', {
              value: {
                type: Support.Sequelize.DECIMAL(10, 3),
                field: 'value'
              }
            })
          , transTest = function (val) {
              return self.sequelize.transaction({isolationLevel: 'SERIALIZABLE'}, function(t) {
                return SumSumSum.sum('value', {transaction: t}).then(function (balance) {
                  return SumSumSum.create({value: -val}, {transaction: t});
                });
              });
            }
          , self = this;
        // Attention: this test is a bit racy. If you find a nicer way to test this: go ahead
        return SumSumSum.sync({force: true}).then(function () {
          return (expect(Promise.join(transTest(80), transTest(80), transTest(80))).to.eventually.be.rejectedWith('could not serialize access due to read/write dependencies among transactions'));
        }).delay(100).then(function() {
          if (self.sequelize.test.$runningQueries !== 0) {
            return self.sequelize.Promise.delay(200);
          }
          return void 0;
        }).then(function() {
          if (self.sequelize.test.$runningQueries !== 0) {
            return self.sequelize.Promise.delay(500);
          }
        });
      });
    }

  });

  it('does not allow queries after commit', function() {
    var self = this;
    return expect(
      this.sequelize.transaction().then(function(t) {
        return self.sequelize.query('SELECT 1+1', {transaction: t, raw: true}).then(function() {
          return t.commit();
        }).then(function() {
          return self.sequelize.query('SELECT 1+1', {transaction: t, raw: true});
        });
      })
    ).to.eventually.be.rejected;
  });

  it('does not allow queries after rollback', function() {
    var self = this;
    return expect(
      this.sequelize.transaction().then(function(t) {
        return self.sequelize.query('SELECT 1+1', {transaction: t, raw: true}).then(function() {
          return t.commit();
        }).then(function() {
          return self.sequelize.query('SELECT 1+1', {transaction: t, raw: true});
        });
      })
    ).to.eventually.be.rejected;
  });

  it('does not allow commits after commit', function () {
    var self = this;
    return expect(self.sequelize.transaction().then(function (t) {
      return t.commit().then(function () {
        return t.commit();
      });
    })).to.be.rejectedWith('Error: Transaction cannot be committed because it has been finished with state: commit');
  });

  it('does not allow commits after rollback', function () {
    var self = this;
    return expect(self.sequelize.transaction().then(function (t) {
      return t.rollback().then(function () {
        return t.commit();
      });
    })).to.be.rejectedWith('Error: Transaction cannot be committed because it has been finished with state: rollback');
  });

  it('does not allow rollbacks after commit', function () {
    var self = this;
    return expect(self.sequelize.transaction().then(function (t) {
      return t.commit().then(function () {
        return t.rollback();
      });
    })).to.be.rejectedWith('Error: Transaction cannot be rolled back because it has been finished with state: commit');
  });

  it('does not allow rollbacks after rollback', function () {
    var self = this;
    return expect(self.sequelize.transaction().then(function (t) {
      return t.rollback().then(function () {
        return t.rollback();
      });
    })).to.be.rejectedWith('Error: Transaction cannot be rolled back because it has been finished with state: rollback');
  });

  if (dialect === 'sqlite'){
    it('provides persistent transactions', function () {
      var sequelize = new Support.Sequelize('database', 'username', 'password', {dialect: 'sqlite'})
        , User = sequelize.define('user', {
            username: Support.Sequelize.STRING,
            awesome: Support.Sequelize.BOOLEAN
          })
        , persistentTransaction;

      return sequelize.transaction().then(function(t) {
        return sequelize.sync({ transaction:t }).then(function( ) {
          return t;
        });
      }).then(function(t) {
        return User.create({}, {transaction:t}).then(function( ) {
          return t.commit();
        });
      }).then(function() {
        return sequelize.transaction().then(function(t) {
          persistentTransaction = t;
        });
      }).then(function() {
        return User.findAll({transaction: persistentTransaction}).then(function(users) {
          expect(users.length).to.equal(1);
          return persistentTransaction.commit();
        });
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
              },
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
                    },
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
                  }, {
                    transaction: t1
                  }).then(function() {
                    t1Spy();
                    return Promise.delay(2000).then(function () {
                      return t1.commit();
                    });
                  })
                );
              });
            });
          });
        });
      });

      it('fail locking with outer joins', function() {
        var User = this.sequelize.define('User', { username: Support.Sequelize.STRING })
          , Task = this.sequelize.define('Task', { title: Support.Sequelize.STRING, active: Support.Sequelize.BOOLEAN })
          , self = this;

        User.belongsToMany(Task, { through: 'UserTasks' });
        Task.belongsToMany(User, { through: 'UserTasks' });

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.join(
            User.create({ username: 'John'}),
            Task.create({ title: 'Get rich', active: false}),
          function (john, task1) {
            return john.setTasks([task1]);
          }).then(function() {
            return self.sequelize.transaction(function(t1) {

              if (current.dialect.supports.lockOuterJoinFailure) {

                return expect(User.find({
                  where: {
                    username: 'John'
                  },
                  include: [Task],
                  lock: t1.LOCK.UPDATE,
                  transaction: t1
                })).to.be.rejectedWith('FOR UPDATE cannot be applied to the nullable side of an outer join');

              } else {

                return User.find({
                  where: {
                    username: 'John'
                  },
                  include: [Task],
                  lock: t1.LOCK.UPDATE,
                  transaction: t1
                });

              }
            });
          });
        });
      });

      if (current.dialect.supports.lockOf) {
        it('supports for update of table', function() {
          var User = this.sequelize.define('User', { username: Support.Sequelize.STRING }, { tableName: 'Person' })
            , Task = this.sequelize.define('Task', { title: Support.Sequelize.STRING, active: Support.Sequelize.BOOLEAN })
            , self = this;

          User.belongsToMany(Task, { through: 'UserTasks' });
          Task.belongsToMany(User, { through: 'UserTasks' });

          return this.sequelize.sync({ force: true }).then(function() {
            return Promise.join(
              User.create({ username: 'John'}),
              Task.create({ title: 'Get rich', active: false}),
              Task.create({ title: 'Die trying', active: false}),
            function (john, task1) {
              return john.setTasks([task1]);
            }).then(function() {
              return self.sequelize.transaction(function(t1) {
                return User.find({
                  where: {
                    username: 'John'
                  },
                  include: [Task],
                  lock: {
                    level: t1.LOCK.UPDATE,
                    of: User
                  },
                  transaction: t1
                }).then(function(t1John) {
                  // should not be blocked by the lock of the other transaction
                  return self.sequelize.transaction(function(t2) {
                    return Task.update({
                      active: true
                    }, {
                      where: {
                        active: false
                      },
                      transaction: t2
                    });
                  }).then(function() {
                    return t1John.save({
                      transaction: t1
                    });
                  });
                });
              });
            });
          });
        });
      }

      if (current.dialect.supports.lockKey) {
        it('supports for key share', function() {
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
                },
                lock: t1.LOCK.NO_KEY_UPDATE,
                transaction: t1
              }).then(function(t1Jan) {
                return self.sequelize.transaction().then(function(t2) {
                  return Promise.join(
                    User.find({
                      where: {
                        username: 'jan'
                      },
                      lock: t2.LOCK.KEY_SHARE,
                      transaction: t2
                    }).then(function() {
                      t2Spy();
                      return t2.commit();
                    }),
                    t1Jan.update({
                      awesome: true
                    }, {
                      transaction: t1
                    }).then(function() {
                      return Promise.delay(2000).then(function () {
                        t1Spy();
                        expect(t1Spy).to.have.been.calledAfter(t2Spy);
                        return t1.commit();
                      });
                    })
                  );
                });
              });
            });
          });
        });
      }

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
              },
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
                    },
                    transaction: t2
                  }).then(function(t2Jan) {
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
