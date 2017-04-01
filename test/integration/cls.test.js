'use strict';

/* jshint camelcase: false */
/* jshint -W030 */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  , Promise   = Sequelize.Promise
  , cls       = require('continuation-local-storage')
  , current = Support.sequelize;

if (current.dialect.supports.transactions) {
  describe(Support.getTestDialectTeaser('Continuation local storage'), function () {
    before(function () {
      Sequelize.cls = cls.createNamespace('sequelize');
    });

    after(function () {
      delete Sequelize.cls;
    });

    beforeEach(function () {
      return Support.prepareTransactionTest(this.sequelize).bind(this).then(function (sequelize) {
        this.sequelize = sequelize;

        this.ns = cls.getNamespace('sequelize');

        this.User = this.sequelize.define('user', {
          name: Sequelize.STRING
        });
        return this.sequelize.sync({ force: true });
      });
    });

    describe('context', function () {
      it('supports several concurrent transactions', function () {
        var t1id, t2id, self = this;

        return Promise.join(
          this.sequelize.transaction(function () {
            t1id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          this.sequelize.transaction(function () {
            t2id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          function () {
            expect(t1id).to.be.ok;
            expect(t2id).to.be.ok;
            expect(t1id).not.to.equal(t2id);
          }
        );
      });

      it('supports nested promise chains', function () {
        var self = this;

        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;

          return self.User.findAll().then(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('does not leak variables to the outer scope', function () {
        // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
        // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

        var self = this
          , transactionSetup = false
          , transactionEnded = false;

        this.sequelize.transaction(function () {
          transactionSetup = true;

          return Promise.delay(500).then(function () {
            expect(self.ns.get('transaction')).to.be.ok;
            transactionEnded = true;
          });
        });

        return new Promise(function (resolve)  {
          // Wait for the transaction to be setup
          var interval = setInterval(function () {
            if (transactionSetup) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        }).bind(this).then(function () {
          expect(transactionEnded).not.to.be.ok;

          expect(this.ns.get('transaction')).not.to.be.ok;

          // Just to make sure it didn't change between our last check and the assertion
          expect(transactionEnded).not.to.be.ok;
        });
      });

      it('does not leak variables to the following promise chain', function () {
        return this.sequelize.transaction(function () {
          return Promise.resolve();
        }).bind(this).then(function () {
          expect(this.ns.get('transaction')).not.to.be.ok;
        });
      });

      it('does not leak outside findOrCreate', function () {
        var self = this;

        return this.User.findOrCreate({
          where: {
            name: 'Kafka'
          },
          logging: function (sql) {
            if (/default/.test(sql)) {
              throw new Error('The transaction was not properly assigned');
            }
          }
        }).then(function () {
          return self.User.findAll();
        });
      });
    });

    describe('sequelize.query integration', function () {
      it('automagically uses the transaction in all calls', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          return self.User.create({ name: 'bob' }).then(function () {
            return Promise.all([
              expect(self.User.findAll({ transaction: null })).to.eventually.have.length(0),
              expect(self.User.findAll({})).to.eventually.have.length(1)
            ]);
          });
        });
      });
    });

    describe('bluebird shims', function () {
      beforeEach(function () {
        // Make sure we have some data so the each, map, filter, ... actually run and validate asserts
        return this.sequelize.Promise.all([this.User.create({ name: 'bob' }), this.User.create({ name: 'joe' })]);
      });

      it('join', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.join(self.User.findAll(), function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('then fulfilled', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().then(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('then rejected', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.reject(new Error('test rejection handler')).then(null,function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('spread', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().spread(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          },function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('catch', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.try(function () {
            throw new Error('To test catch');
          }).catch(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('error', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.try(function () {
            throw new self.sequelize.Promise.OperationalError('To test catch');
          }).error(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('finally', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().finally( function(){
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('map', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().map(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('static map', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.map(self.User.findAll(), function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('mapSeries', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().mapSeries(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('static mapSeries', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          // In order to execute promises serially with mapSeries we must wrap them as functions
          return self.sequelize.Promise.mapSeries(
            [
              function() {
                return self.User.findAll().then(
                  function() {expect(self.ns.get('transaction').id).to.be.ok;}
                );
              },
              function() {
                return self.User.findAll().then(
                  function() {expect(self.ns.get('transaction').id).to.equal(tid);}
                );
              }
            ],
            function(runPromise) {return runPromise();}
          );
        });
      });

      it('reduce', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().reduce(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('static reduce', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.reduce(self.User.findAll(), function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('filter', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().filter(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('static filter', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.filter(self.User.findAll(), function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('each', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().each(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('static each', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.sequelize.Promise.each(self.User.findAll(), function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('nodeify', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().nodeify(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('tap', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return self.User.findAll().tap(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('done fulfilled', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return new Promise(function (resolve, reject) {
            self.User.findAll().done(function () {
              try {
                expect(self.ns.get('transaction').id).to.be.ok;
                expect(self.ns.get('transaction').id).to.equal(tid);
                resolve();
              } catch (err) {
                reject(err);
              }
            }, function (err) {
              reject(err);
            });
          });
        });
      });

      it('done rejected', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;
          return new Promise(function (resolve, reject) {
            Promise.reject(new Error('test rejection handler')).done(function () {
              reject(new Error('Should not have called first done handler'));
            }, function (err) {
              try {
                expect(self.ns.get('transaction').id).to.be.ok;
                expect(self.ns.get('transaction').id).to.equal(tid);
                resolve();
              } catch (err) {
                reject(err);
              }
            });
          });
        });
      });
    });

  });
}
