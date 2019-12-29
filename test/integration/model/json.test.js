'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  moment = require('moment'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.JSON) {
    describe('JSON', () => {
      beforeEach(function() {
        this.Event = this.sequelize.define('Event', {
          data: {
            type: DataTypes.JSON,
            field: 'event_data',
            index: true
          },
          json: DataTypes.JSON
        });

        return this.Event.sync({ force: true });
      });

      if (current.dialect.supports.lock) {
        it('findOrCreate supports transactions, json and locks', function() {
          return current.transaction().then(transaction => {
            return this.Event.findOrCreate({
              where: {
                json: { some: { input: 'Hello' } }
              },
              defaults: {
                json: { some: { input: 'Hello' }, input: [1, 2, 3] },
                data: { some: { input: 'There' }, input: [4, 5, 6] }
              },
              transaction,
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

      describe('create', () => {
        it('should create an instance with JSON data', function() {
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
      });

      describe('update', () => {
        it('should update with JSON column (dot notation)', function() {
          return this.Event.bulkCreate([{
            id: 1,
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }, {
            id: 2,
            data: {
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Multiverse Scientist'
            }
          }]).then(() => this.Event.update({
            'data': {
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Galactic Fed Prisioner'
            }
          }, {
            where: {
              'data.name.first': 'Rick'
            }
          })).then(() => this.Event.findById(2)).then(event => {
            expect(event.get('data')).to.eql({
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Galactic Fed Prisioner'
            });
          });
        });

        it('should update with JSON column (JSON notation)', function() {
          return this.Event.bulkCreate([{
            id: 1,
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }, {
            id: 2,
            data: {
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Multiverse Scientist'
            }
          }]).then(() => this.Event.update({
            'data': {
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Galactic Fed Prisioner'
            }
          }, {
            where: {
              data: {
                name: {
                  first: 'Rick'
                }
              }
            }
          })).then(() => this.Event.findById(2)).then(event => {
            expect(event.get('data')).to.eql({
              name: {
                first: 'Rick',
                last: 'Sanchez'
              },
              employment: 'Galactic Fed Prisioner'
            });
          });
        });

        it('should update an instance with JSON data', function() {
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
      });

      describe('find', () => {
        it('should be possible to query a nested value', function() {
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

        it('should be possible to query dates with array operators', function() {
          const now = moment().milliseconds(0).toDate();
          const before = moment().milliseconds(0).subtract(1, 'day').toDate();
          const after = moment().milliseconds(0).add(1, 'day').toDate();
          return Promise.join(
            this.Event.create({
              json: {
                user: 'Homer',
                lastLogin: now
              }
            })
          ).then(() => {
            return this.Event.findAll({
              where: {
                json: {
                  lastLogin: now
                }
              }
            }).then(events => {
              const event = events[0];

              expect(events.length).to.equal(1);
              expect(event.get('json')).to.eql({
                user: 'Homer',
                lastLogin: now.toISOString()
              });
            });
          }).then(() => {
            return this.Event.findAll({
              where: {
                json: {
                  lastLogin: {$between: [before, after]}
                }
              }
            }).then(events => {
              const event = events[0];

              expect(events.length).to.equal(1);
              expect(event.get('json')).to.eql({
                user: 'Homer',
                lastLogin: now.toISOString()
              });
            });
          });
        });

        it('should be possible to query a boolean with array operators', function() {
          return Promise.join(
            this.Event.create({
              json: {
                user: 'Homer',
                active: true
              }
            })
          ).then(() => {
            return this.Event.findAll({
              where: {
                json: {
                  active: true
                }
              }
            }).then(events => {
              const event = events[0];

              expect(events.length).to.equal(1);
              expect(event.get('json')).to.eql({
                user: 'Homer',
                active: true
              });
            });
          }).then(() => {
            return this.Event.findAll({
              where: {
                json: {
                  active: {$in: [true, false]}
                }
              }
            }).then(events => {
              const event = events[0];

              expect(events.length).to.equal(1);
              expect(event.get('json')).to.eql({
                user: 'Homer',
                active: true
              });
            });
          });
        });

        it('should be possible to query a nested integer value', function() {
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

        it('should be possible to query a nested null value', function() {
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

        it('should be possible to query for nested fields with hyphens/dashes, #8718', function() {
          return Promise.join(
            this.Event.create({
              data: {
                name: {
                  first: 'Homer',
                  last: 'Simpson'
                },
                status_report: {
                  'red-indicator': {
                    'level$$level': true
                  }
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
                  status_report: {
                    'red-indicator': {
                      'level$$level': true
                    }
                  }
                }
              }
            }).then(events => {
              expect(events.length).to.equal(1);
              expect(events[0].get('data')).to.eql({
                name: {
                  first: 'Homer',
                  last: 'Simpson'
                },
                status_report: {
                  'red-indicator': {
                    'level$$level': true
                  }
                },
                employment: 'Nuclear Safety Inspector'
              });
            });
          });
        });

        it('should be possible to query multiple nested values', function() {
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

        it('should be possible to query a nested value and order results', function() {
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
                  }
                }
              },
              order: [
                ['data.name.first']
              ]
            }).then(events => {
              expect(events.length).to.equal(3);

              expect(events[0].get('data')).to.eql({
                name: {
                  first: 'Bart',
                  last: 'Simpson'
                },
                employment: 'None'
              });

              expect(events[1].get('data')).to.eql({
                name: {
                  first: 'Homer',
                  last: 'Simpson'
                },
                employment: 'Nuclear Safety Inspector'
              });

              expect(events[2].get('data')).to.eql({
                name: {
                  first: 'Marge',
                  last: 'Simpson'
                },
                employment: 'Housewife'
              });
            });
          });
        });
      });

      describe('destroy', () => {
        it('should be possible to destroy with where', function() {
          const conditionSearch = {
            where: {
              data: {
                employment: 'Hacker'
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

      describe('sql injection attacks', () => {
        beforeEach(function() {
          this.Model = this.sequelize.define('Model', {
            data: DataTypes.JSON
          });
          return this.sequelize.sync({ force: true });
        });

        it('should properly escape the single quotes', function() {
          return this.Model.create({
            data: {
              type: 'Point',
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- "
              }
            }
          });
        });

        it('should properly escape the single quotes in array', function() {
          return this.Model.create({
            data: {
              type: 'Point',
              coordinates: [39.807222, "'); DELETE YOLO INJECTIONS; --"]
            }
          });
        });

        it('should be possible to find with properly escaped select query', function() {
          return this.Model.create({
            data: {
              type: 'Point',
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- "
              }
            }
          }).then(() => {
            return this.Model.findOne({
              where: {
                data: {
                  type: 'Point',
                  properties: {
                    exploit: "'); DELETE YOLO INJECTIONS; -- "
                  }
                }
              }
            });
          }).then(result => {
            expect(result.get('data')).to.deep.equal({
              type: 'Point',
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- "
              }
            });
          });
        });

        it('should query an instance with JSONB data and order while trying to inject', function() {
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
            if (current.options.dialect === 'sqlite') {
              return this.Event.findAll({
                where: {
                  data: {
                    name: {
                      last: 'Simpson'
                    }
                  }
                },
                order: [
                  ["data.name.first}'); INSERT INJECTION HERE! SELECT ('"]
                ]
              }).then(events => {
                expect(events).to.be.ok;
                expect(events[0].get('data')).to.eql({
                  name: {
                    first: 'Homer',
                    last: 'Simpson'
                  },
                  employment: 'Nuclear Safety Inspector'
                });
              });
            } else if (current.options.dialect === 'postgres') {
              return expect(this.Event.findAll({
                where: {
                  data: {
                    name: {
                      last: 'Simpson'
                    }
                  }
                },
                order: [
                  ["data.name.first}'); INSERT INJECTION HERE! SELECT ('"]
                ]
              })).to.eventually.be.rejectedWith(Error);
            }
          });
        });
      });
    });
  }

});
