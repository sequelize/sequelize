'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , Promise = require(__dirname + '/../../lib/promise')
  , Transaction = require(__dirname + '/../../lib/transaction')
  , current = Support.sequelize;

if (current.dialect.supports.transactions) {

describe(Support.getTestDialectTeaser('Sequelize#transaction'), function() {
  describe('then', function() {
    it('gets triggered once a transaction has been successfully committed', function() {
      var called = false;
      return this
        .sequelize
        .transaction().then(function(t) {
          return t.commit().then(function () {
            called = 1;
          });
        })
        .then(function() {
          expect(called).to.be.ok;
        });
    });

    it('gets triggered once a transaction has been successfully rolled back', function() {
      var called = false;
      return this
        .sequelize
        .transaction().then(function(t) {
          return t.rollback().then(function () {
            called = 1;
          });
        })
        .then(function() {
          expect(called).to.be.ok;
        });
    });

    if (Support.getTestDialect() !== 'sqlite') {
      it('works for long running transactions', function() {
        this.timeout(10000);
        return Support.prepareTransactionTest(this.sequelize).bind(this).then(function(sequelize) {
          this.sequelize = sequelize;

          this.User = sequelize.define('User', {
            name: Support.Sequelize.STRING
          }, { timestamps: false });

          return sequelize.sync({ force: true });
        }).then(function() {
          return this.sequelize.transaction();
        }).then(function(t) {
          var query = 'select sleep(2);';

          switch (Support.getTestDialect()) {
          case 'postgres':
            query = 'select pg_sleep(2);';
            break;
          case 'sqlite':
            query = 'select sqlite3_sleep(2000);';
            break;
          default:
            break;
          }

          return this.sequelize.query(query, { transaction: t }).bind(this).then(function() {
            return this.User.create({ name: 'foo' });
          }).then(function() {
            return this.sequelize.query(query, { transaction: t });
          }).then(function() {
            return t.commit();
          });
        }).then(function() {
          return this.User.all();
        }).then(function(users) {
          expect(users.length).to.equal(1);
          expect(users[0].name).to.equal('foo');
        });
      });
    }
  });

  describe('complex long running example', function() {
    it('works with promise syntax', function() {
      return Support.prepareTransactionTest(this.sequelize).then(function(sequelize) {
        var Test = sequelize.define('Test', {
          id: { type: Support.Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
          name: { type: Support.Sequelize.STRING }
        });

        return sequelize.sync({ force: true }).then(function() {
          return sequelize.transaction().then(function(transaction) {
            expect(transaction).to.be.instanceOf(Transaction);

            return Test
              .create({ name: 'Peter' }, { transaction: transaction })
              .then(function() {
                return Promise.delay(1000).then(function () {
                  return transaction
                    .commit()
                    .then(function() { return Test.count(); })
                    .then(function(count) {
                      expect(count).to.equal(1);
                    });
                });
              });
          });
        });
      });
    });
  });

  describe('concurrency', function() {
    describe('having tables with uniqueness constraints', function() {
      beforeEach(function() {
        var self = this;

        return Support.prepareTransactionTest(this.sequelize).then(function(sequelize) {
          self.sequelize = sequelize;

          self.Model = sequelize.define('Model', {
            name: { type: Support.Sequelize.STRING, unique: true }
          }, {
            timestamps: false
          });

          return self.Model.sync({ force: true });
        });
      });

      it('triggers the error event for the second transactions', function() {
        var self = this;

        return this.sequelize.transaction().then(function(t1) {
          return self.sequelize.transaction().then(function(t2) {
            return self.Model.create({ name: 'omnom' }, { transaction: t1 }).then(function(m1) {
              return Promise.all([
                self.Model.create({ name: 'omnom' }, { transaction: t2 }).catch(function(err) {
                  expect(err).to.be.defined;
                  return t2.rollback();
                }),
                Promise.delay(100).then(function() {
                  return t1.commit();
                })
              ]);
            });
          });
        });
      });
    });
  });
});

}
