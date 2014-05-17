var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , dialect     = Support.getTestDialect()
  , Transaction = require(__dirname + '/../lib/transaction')
  , sinon       = require('sinon')


describe(Support.getTestDialectTeaser("Transaction"), function () {
  this.timeout(4000);
  describe('constructor', function() {
    it('stores options', function() {
      var transaction = new Transaction(this.sequelize)
      expect(transaction.options).to.be.an.instanceOf(Object)
    })

    it('generates an identifier', function() {
      var transaction = new Transaction(this.sequelize)
      expect(transaction.id).to.exist
    })
  })

  describe('success', function() {
    it("is a success method available", function() {
      expect(Transaction).to.respondTo("success")
    })
  })

  describe('error', function() {
    it("is an error method available", function() {
      expect(Transaction).to.respondTo("error")
    })
  })

  describe('commit', function() {
    it('is a commit method available', function() {
      expect(Transaction).to.respondTo('commit')
    })
  })

  describe('rollback', function() {
    it('is a rollback method available', function() {
      expect(Transaction).to.respondTo('rollback')
    })
  })

  describe('done', function() {
    it('gets called when the transaction gets commited', function(done) {
      var transaction = new Transaction(this.sequelize)

      transaction.done(done)
      transaction.prepareEnvironment(function() {
        transaction.commit()
      })
    })

    it('works for long running transactions', function(done) {
      var transaction = new Transaction(this.sequelize)
        , self        = this

      transaction.done(done)
      transaction.prepareEnvironment(function() {
        setTimeout(function() {
          self.sequelize.query('select 1+1 as sum', null, {
            raw: true,
            plain: true,
            transaction: transaction
          }).done(function(err, result) {
            expect(err).to.be.null
            expect(result.sum).to.equal(2)
            transaction.commit()
          })
        }, 2000)
      })
    })
  })

  if (dialect !== 'sqlite') {
    describe('row locking', function () {
      this.timeout(10000);
      it('supports for update', function (done) {
        var User = this.sequelize.define('user', {
              username: Support.Sequelize.STRING,
              awesome: Support.Sequelize.BOOLEAN
            })
          , self = this
          , t1Spy = sinon.spy()
          , t2Spy = sinon.spy()

        this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'jan'})
        }).then(function () {
          self.sequelize.transaction(function (t1) {
            return User.find({
              where: {
                username: 'jan'
              }
            }, { 
              lock: t1.LOCK.UPDATE,
              transaction: t1
            }).then(function (t1Jan) {
              self.sequelize.transaction({
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
              }, function (t2) {
                User.find({
                  where: {
                    username: 'jan'
                  },
                }, { 
                  lock: t2.LOCK.UPDATE, 
                  transaction: t2
                }).then(function () {
                  t2Spy()
                  t2.commit().then(function () {
                    expect(t2Spy).to.have.been.calledAfter(t1Spy) // Find should not succeed before t1 has comitted
                    done()
                  })
                })

                t1Jan.updateAttributes({
                  awesome: true
                }, { transaction: t1}).then(function () {
                  t1Spy()
                  setTimeout(t1.commit.bind(t1), 2000)
                })
              })
            })
          })
        })
      })

      it('supports for share', function (done) {
        var User = this.sequelize.define('user', {
              username: Support.Sequelize.STRING,
              awesome: Support.Sequelize.BOOLEAN
            })
          , self = this
          , t1Spy = sinon.spy()
          , t2FindSpy = sinon.spy()
          , t2UpdateSpy = sinon.spy()

        this.sequelize.sync({ force: true }).then(function () {
          return User.create({ username: 'jan'})
        }).then(function () {
          self.sequelize.transaction(function (t1) {
            return User.find({
              where: {
                username: 'jan'
              }
            }, { 
              lock: t1.LOCK.SHARE,
              transaction: t1
            }).then(function (t1Jan) {
              self.sequelize.transaction({
                isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
              }, function (t2) {
                User.find({
                  where: {
                    username: 'jan'
                  }
                }, { transaction: t2}).then(function (t2Jan) {
                  t2FindSpy()

                  t2Jan.updateAttributes({
                    awesome: false
                  }, { 
                    transaction: t2
                  }).then(function () {
                    t2UpdateSpy()
                    t2.commit().then(function () {
                      expect(t2FindSpy).to.have.been.calledBefore(t1Spy) // The find call should have returned
                      expect(t2UpdateSpy).to.have.been.calledAfter(t1Spy) // But the update call should not happen before the first transaction has committed
                      done()
                    })
                  })
                })

                t1Jan.updateAttributes({
                  awesome: true
                }, {
                  transaction: t1
                }).then(function () {
                  setTimeout(function () {
                    t1Spy()
                    t1.commit()
                  }, 2000)
                })
              })
            })
          })
        })
      })
    })
  }
})
