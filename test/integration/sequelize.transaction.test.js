'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  Promise = require('../../lib/promise'),
  Transaction = require('../../lib/transaction'),
  sinon = require('sinon'),
  current = Support.sequelize;

if (current.dialect.supports.transactions) {

  describe(Support.getTestDialectTeaser('Sequelize#transaction'), () => {
    beforeEach(function() {
      this.sinon = sinon.createSandbox();
    });

    afterEach(function() {
      this.sinon.restore();
    });

    describe('then', () => {
      it('gets triggered once a transaction has been successfully committed', function() {
        let called = false;
        return this
          .sequelize
          .transaction().then(t => {
            return t.commit().then(() => {
              called = 1;
            });
          })
          .then(() => {
            expect(called).to.be.ok;
          });
      });

      it('gets triggered once a transaction has been successfully rolled back', function() {
        let called = false;
        return this
          .sequelize
          .transaction().then(t => {
            return t.rollback().then(() => {
              called = 1;
            });
          })
          .then(() => {
            expect(called).to.be.ok;
          });
      });

      if (Support.getTestDialect() !== 'sqlite') {
        it('works for long running transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
            this.sequelize = sequelize;

            this.User = sequelize.define('User', {
              name: Support.Sequelize.STRING
            }, { timestamps: false });

            return sequelize.sync({ force: true });
          }).then(() => {
            return this.sequelize.transaction();
          }).then(t => {
            let query = 'select sleep(2);';

            switch (Support.getTestDialect()) {
              case 'postgres':
                query = 'select pg_sleep(2);';
                break;
              case 'sqlite':
                query = 'select sqlite3_sleep(2000);';
                break;
              case 'mssql':
                query = 'WAITFOR DELAY \'00:00:02\';';
                break;
              default:
                break;
            }

            return this.sequelize.query(query, { transaction: t }).then(() => {
              return this.User.create({ name: 'foo' });
            }).then(() => {
              return this.sequelize.query(query, { transaction: t });
            }).then(() => {
              return t.commit();
            });
          }).then(() => {
            return this.User.findAll();
          }).then(users => {
            expect(users.length).to.equal(1);
            expect(users[0].name).to.equal('foo');
          });
        });
      }
    });

    describe('complex long running example', () => {
      it('works with promise syntax', function() {
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          const Test = sequelize.define('Test', {
            id: { type: Support.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            name: { type: Support.Sequelize.STRING }
          });

          return sequelize.sync({ force: true }).then(() => {
            return sequelize.transaction().then(transaction => {
              expect(transaction).to.be.instanceOf(Transaction);

              return Test
                .create({ name: 'Peter' }, { transaction })
                .then(() => {
                  return Promise.delay(1000).then(() => {
                    return transaction
                      .commit()
                      .then(() => { return Test.count(); })
                      .then(count => {
                        expect(count).to.equal(1);
                      });
                  });
                });
            });
          });
        });
      });
    });

    describe('concurrency', () => {
      describe('having tables with uniqueness constraints', () => {
        beforeEach(function() {
          return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
            this.sequelize = sequelize;

            this.Model = sequelize.define('Model', {
              name: { type: Support.Sequelize.STRING, unique: true }
            }, {
              timestamps: false
            });

            return this.Model.sync({ force: true });
          });
        });

        it('triggers the error event for the second transactions', function() {
          return this.sequelize.transaction().then(t1 => {
            return this.sequelize.transaction().then(t2 => {
              return this.Model.create({ name: 'omnom' }, { transaction: t1 }).then(() => {
                return Promise.all([
                  this.Model.create({ name: 'omnom' }, { transaction: t2 }).catch(err => {
                    expect(err).to.be.ok;
                    return t2.rollback();
                  }),
                  Promise.delay(100).then(() => {
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
