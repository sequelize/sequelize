var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , Transaction = require(__dirname + '/../lib/transaction')

describe(Support.getTestDialectTeaser("Sequelize#transaction"), function () {
  describe('success', function() {
    it("gets triggered once a transaction has been successfully committed", function(done) {
      this
        .sequelize
        .transaction(function(t) { t.commit() })
        .success(function() { done() })
    })

    it("gets triggered once a transaction has been successfully rollbacked", function(done) {
      this
        .sequelize
        .transaction(function(t) { t.rollback() })
        .success(function() { done() })
    })

    it('works for long running transactions', function(done) {
      Support.prepareTransactionTest(this.sequelize, function(sequelize) {
        var User = sequelize.define('User', {
          name: Support.Sequelize.STRING
        }, { timestamps: false })

        sequelize.sync({ force: true }).success(function() {
          sequelize
            .transaction(function(t) {
              var query = 'select sleep(2);'

              switch(Support.getTestDialect()) {
                case 'postgres':
                  query = 'select pg_sleep(2);'
                  break
                case 'sqlite':
                  query = 'select sqlite3_sleep(2);'
                  break
                default:
                  break
              }

              sequelize.query(query, null, {
                raw: true,
                plain: true,
                transaction: t
              }).done(function() {
                var dao = User.build({ name: 'foo' })


                // this.QueryGenerator.insertQuery(tableName, values, dao.daoFactory.rawAttributes)
                query = sequelize
                  .getQueryInterface()
                  .QueryGenerator
                  .insertQuery(User.tableName, dao.values, User.rawAttributes)

                setTimeout(function() {
                  sequelize.query(query, null, {
                    raw: true,
                    plain: true,
                    transaction: t
                  }).done(function(err, res) {
                    t.commit()
                  })
                }, 2000)
              })
            })
            .success(function() {
              User.all().success(function(users) {
                expect(users.length).to.equal(1)
                expect(users[0].name).to.equal('foo')

                done()
              })
            })
          })
        })
      })
  })

  describe('error', function() {
    if (Support.getTestDialect() === 'sqlite') {
      // not sure if we can test this in sqlite ...
      // how could we enforce an authentication error in sqlite?
    } else {
      it("gets triggered once an error occurs", function(done) {
        var sequelize = Support.createSequelizeInstance({ dialect: Support.getTestDialect() })

        // lets overwrite the host to get an error
        sequelize.config.username = 'foobarbaz'

        sequelize
          .transaction(function() {})
          .error(function(err) {
            expect(err).to.not.be.undefined
            done()
          })
      })
    }
  })

  describe('callback', function() {
    it("receives the transaction if only one argument is passed", function(done) {
      this.sequelize.transaction(function(t) {
        expect(t).to.be.instanceOf(Transaction)
        t.commit()
      }).done(done)
    })

    it("receives an error and the transaction if two arguments are passed", function(done) {
      this.sequelize.transaction(function(err, t) {
        expect(err).to.not.be.instanceOf(Transaction)
        expect(t).to.be.instanceOf(Transaction)
        t.commit()
      }).done(done)
    })
  })

  describe('complex long running example', function() {
    it("works", function(done) {
      var Q = require('q'),
          http = require('http'),
          sequelize = this.sequelize,

          properties = {
              id : {type : Support.Sequelize.INTEGER, primaryKey : true, autoIncrement : true},
              name : { type : Support.Sequelize.STRING }
          },

          Test = sequelize.define('Test', properties);

      function createTable() {
          var deferred = Q.defer();

          sequelize.sync({ force: true }).success(function () {
              console.info('Database: created table');
              deferred.resolve();
          }).error(function (error) {
              console.error(error);
              deferred.reject();
          });

          return deferred.promise;
      }

      function createUser(transaction) {
          var deferred = Q.defer();

          Test.create({name: 'Peter'}, {transaction: transaction})
              .success(function (createdUser) {
                  console.info('Database: created new user');
                  deferred.resolve(createdUser);
              }).error(function (error) {
                  console.error(error);
                  deferred.reject();
              });

          return deferred.promise;
      }

      function foobarbaz(u) {
          var deferred = Q.defer();

          setTimeout(function() { deferred.resolve() }, 1000)

          // http.get("http://mandrillapp.com/api/1.0/messages/send-template.json", function (response) {
          //     console.log("Got response: " + response.statusCode);
          //     deferred.resolve(u);
          // }).on('error', function (e) {
          //     console.log("Got error: " + e.message);
          //     deferred.reject();
          // });

          return deferred.promise;
      }

      function doStuff(transaction) {
          return createUser(transaction)
              .then(function() { return readTests('Before http call without transaction') })
              .then(function() { return readTests('Before http call with transaction', transaction) })
              .then(function(){ return foobarbaz() })
              .then(function() { return readTests('Directly after http call without transaction') })
              .then(function() { return readTests('Directly after http call with transaction', transaction) })

      }

      function readTests(msg, transaction) {
          var deferred = Q.defer()

          console.log("-", msg)

          Test.count({ transaction: transaction }).done(function(err, count) {
              console.log(err, count)
              !!err ? deferred.reject() : deferred.resolve()
          })

          return deferred.promise
      }

      function run() {
          var deferred = Q.defer();

          sequelize.transaction(function (transaction) {
              transaction.done(function() {
                  console.log()
                  console.log('xxxxxxxxx transaction has been executed')
                  console.log()
              })

              doStuff(transaction)
                  .then(function() { return readTests('After the http call without transaction') })
                  .then(function() { return readTests('After the http call with transaction', transaction) })
                  .then(function (result) {
                      transaction.commit().success(function () {
                          console.log('Commit!');
                          deferred.resolve();
                      });
                  })
                  .fail(function (error) {
                      transaction.rollback().success(function () {
                          console.log('Rollback!');
                          deferred.reject();
                      });
                  });
          });

          return deferred.promise;
      }

      createTable()
          .then(function() { return readTests('After table creation without transaction') })
          .then(run)
          .then(function() { return readTests('After committing the transaction') })
          .done(function () {
              Test.all().success(function(tasks) {
                expect(tasks.length).to.equal(1)
                console.log('Done!');
                done()
              })
          });

    })
  })
})
