'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  if (current.dialect.supports.JSONB) {
    describe('JSONB', function () {
      beforeEach(function () {
        this.Event = this.sequelize.define('Event', {
          data: {
            type: DataTypes.JSONB,
            field: 'event_data',
            index: true
          },
          json: DataTypes.JSON
        });

        return this.Event.sync({force: true});
      });

      if (current.dialect.supports.lock) {
        it('findOrCreate supports transactions, json and locks', function() {
          var self = this;
          return current.transaction().then(function(t) {
            return self.Event.findOrCreate({
              where: {
                json: { some: { input: 'Hello' } }
              },
              defaults: {
                json: { some: { input: 'Hello' }, input: [1, 2, 3] },
                data: { some: { input: 'There' }, input: [4, 5, 6] }
              },
              transaction: t,
              lock: t.LOCK.UPDATE,
              logging: function (sql) {
                if (sql.indexOf('SELECT') !== -1 && sql.indexOf('CREATE') === -1) {
                  expect(sql.indexOf('FOR UPDATE')).not.to.be.equal(-1);
                }
              }
            }).then(function() {
              return self.Event.count().then(function(count) {
                expect(count).to.equal(0);
                return t.commit().then(function() {
                  return self.Event.count().then(function(count) {
                    expect(count).to.equal(1);
                  });
                });
              });
            });
          });
        });
      }

      it('should create an instance with JSONB data', function () {
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).bind(this).then(function () {
          return this.Event.findAll().then(function (events) {
            var event = events[0];

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

      it('should update an instance with JSONB data', function () {
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).bind(this).then(function (event) {
          return event.update({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: null
            }
          });
        }).then(function () {
          return this.Event.findAll().then(function (events) {
            var event = events[0];

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
        ).bind(this).then(function () {
          return this.Event.findAll({
            where: {
              data: {
                employment: 'Housewife'
              }
            }
          }).then(function (events) {
            var event = events[0];

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
        ).bind(this).then(function () {
          return this.Event.findAll({
            where: {
              data: {
                age: {
                  $gt: 38
                }
              }
            }
          }).then(function (events) {
            var event = events[0];

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
        ).bind(this).then(function () {
          return this.Event.findAll({
            where: {
              data: {
                employment: null
              }
            }
          }).then(function (events) {
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
        var self = this;
        return this.Event.create({
          data: {
            name: {
              first: 'Homer',
              last: 'Simpson'
            },
            employment: 'Nuclear Safety Inspector'
          }
        }).then(function() {
          return Promise.join(
            self.Event.create({
              data: {
                name: {
                  first: 'Marge',
                  last: 'Simpson'
                },
                employment: 'Housewife'
              }
            }),
            self.Event.create({
              data: {
                name: {
                  first: 'Bart',
                  last: 'Simpson'
                },
                employment: 'None'
              }
            })
          );
        }).then(function () {
          return self.Event.findAll({
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
          }).then(function (events) {
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
        var conditionSearch = {
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
        ).bind(this).then(function () {
            return expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(2);
          }).then(function() {
            return this.Event.destroy(conditionSearch);
          }).then(function(){
            return expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(0);
          });
      });

    });
  }
});
