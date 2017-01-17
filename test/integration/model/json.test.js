'use strict';

/* jshint -W030 */
/* jshint -W079 */
/* jshint -W110 */
const chai = require('chai')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function () {
  if (current.dialect.supports.JSON) {
    describe('JSON', function () {
      beforeEach(function () {
        this.Event = this.sequelize.define('Event', {
          data: {
            type: DataTypes.JSON,
            field: 'event_data',
            index: true
          },
          json: DataTypes.JSON
        });

        return this.Event.sync({force: true});
      });

      if (current.dialect.supports.lock) {
        it('findOrCreate supports transactions, json and locks', function () {
          return current.transaction().then(transaction => {
            return this.Event.findOrCreate({
              where: {
                json: { some: { input: 'Hello' } }
              },
              defaults: {
                json: { some: { input: 'Hello' }, input: [1, 2, 3] },
                data: { some: { input: 'There' }, input: [4, 5, 6] }
              },
              transaction: transaction,
              lock: transaction.LOCK.UPDATE,
              logging: sql => {
                if (sql.indexOf('SELECT') !== -1 && sql.indexOf('CREATE') === -1) {
                  expect(sql.indexOf('FOR UPDATE')).not.to.be.equal(-1);
                }
              }
            }).then(() => {
              return this.Event.count().then(count => {
                expect(count).to.equal(0);
                return transaction.commit().then(() => {
                  return this.Event.count().then(count => {
                    expect(count).to.equal(1);
                  });
                });
              });
            });
          });
        });
      }

      it('should create an instance with JSON data', function () {
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).then(() => {
          return this.Event.findAll().then(events => {
            const event = events[0];

            expect(event.get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            });
          });
        });
      });

      it('should update an instance with JSON data', function () {
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).then(event => {
          return event.update({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: null
            }
          });
        }).then(() => {
          return this.Event.findAll().then(events => {
            const event = events[0];

            expect(event.get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: null
            });
          });
        });
      });

      it('should be possible to query a nested value', function () {
        return Promise.join(
          this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }),
          this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            }
          })
        ).then(() => {
          return this.Event.findAll({
            where: {
              data: {
                employment: 'Housewife'
              }
            }
          }).then(events => {
            const event = events[0];

            expect(events.length).to.equal(1);
            expect(event.get('data')).to.eql({
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            });
          });
        });
      });

      it('should be possible to query a nested integer value', function () {
        return Promise.join(
          this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              age: 40
            }
          }),
          this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              age: 37
            }
          })
        ).then(() => {
          return this.Event.findAll({
            where: {
              data: {
                age: {
                  $gt: 38
                }
              }
            }
          }).then(events => {
            const event = events[0];

            expect(events.length).to.equal(1);
            expect(event.get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              age: 40
            });
          });
        });
      });

      it('should be possible to query a nested null value', function () {
        return Promise.join(
          this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }),
          this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: null
            }
          })
        ).then(() => {
          return this.Event.findAll({
            where: {
              data: {
                employment: null
              }
            }
          }).then(events => {
            expect(events.length).to.equal(1);
            expect(events[0].get('data')).to.eql({
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: null
            });
          });
        });
      });

      it('should be possible to query multiple nested values', function () {
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).then(() => {
          return Promise.join(
            this.Event.create({
              data: {
                name: {
                  first: 'Marge',
                  last: 'Simpson'
                },
                employment: 'Housewife'
              }
            }),
            this.Event.create({
              data: {
                name: {
                  first: 'Bart',
                  last: 'Simpson'
                },
                employment: 'None'
              }
            })
          );
        }).then(() => {
          return this.Event.findAll({
            where: {
              data: {
                name: {
                  last: 'Simpson'
                },
                employment: {
                  $ne: 'None'
                }
              }
            },
            order: [
              ['id', 'ASC']
            ]
          }).then(events => {
            expect(events.length).to.equal(2);

            expect(events[0].get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            });

            expect(events[1].get('data')).to.eql({
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            });
          });
        });
      });

      it('should be possible to destroy with where', function () {
        const conditionSearch = {
          where: {
            data: {
              employment : 'Hacker'
            }
          }
        };

        return Promise.join(
          this.Event.create({
            data: {
              name: {
                first: 'Elliot',
                last: 'Alderson'
              },
              employment: 'Hacker'
            }
          }),
          this.Event.create({
            data: {
              name: {
                first: 'Christian',
                last: 'Slater'
              },
              employment: 'Hacker'
            }
          }),
          this.Event.create({
            data: {
              name: {
                first: ' Tyrell',
                last: 'Wellick'
              },
              employment: 'CTO'
            }
          })
        ).then(() => {
            return expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(2);
          }).then(() => {
            return this.Event.destroy(conditionSearch);
          }).then(() => {
            return expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(0);
          });
      });

    });
  }
});
