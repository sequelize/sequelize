'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  Op = Sequelize.Op,
  moment = require('moment'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.JSON) {
    describe('JSON', () => {
      beforeEach(async function() {
        this.Event = this.sequelize.define('Event', {
          data: {
            type: DataTypes.JSON,
            field: 'event_data',
            index: true
          },
          json: DataTypes.JSON
        });

        await this.Event.sync({ force: true });
      });

      if (current.dialect.supports.lock) {
        it('findOrCreate supports transactions, json and locks', async function() {
          const transaction = await current.transaction();

          await this.Event.findOrCreate({
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
              if (sql.includes('SELECT') && !sql.includes('CREATE')) {
                expect(sql.includes('FOR UPDATE')).to.be.true;
              }
            }
          });

          const count = await this.Event.count();
          expect(count).to.equal(0);
          await transaction.commit();
          const count0 = await this.Event.count();
          expect(count0).to.equal(1);
        });
      }

      describe('create', () => {
        it('should create an instance with JSON data', async function() {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          });

          const events = await this.Event.findAll();
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

      describe('update', () => {
        it('should update with JSON column (dot notation)', async function() {
          await this.Event.bulkCreate([{
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
          }]);

          await this.Event.update({
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
          });

          const event = await this.Event.findByPk(2);
          expect(event.get('data')).to.eql({
            name: {
              first: 'Rick',
              last: 'Sanchez'
            },
            employment: 'Galactic Fed Prisioner'
          });
        });

        it('should update with JSON column (JSON notation)', async function() {
          await this.Event.bulkCreate([{
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
          }]);

          await this.Event.update({
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
          });

          const event = await this.Event.findByPk(2);
          expect(event.get('data')).to.eql({
            name: {
              first: 'Rick',
              last: 'Sanchez'
            },
            employment: 'Galactic Fed Prisioner'
          });
        });

        it('should update an instance with JSON data', async function() {
          const event0 = await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          });

          await event0.update({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: null
            }
          });

          const events = await this.Event.findAll();
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

      describe('find', () => {
        it('should be possible to query a nested value', async function() {
          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            }
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                employment: 'Housewife'
              }
            }
          });

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

        it('should be possible to query dates with array operators', async function() {
          const now = moment().milliseconds(0).toDate();
          const before = moment().milliseconds(0).subtract(1, 'day').toDate();
          const after = moment().milliseconds(0).add(1, 'day').toDate();

          await Promise.all([this.Event.create({
            json: {
              user: 'Homer',
              lastLogin: now
            }
          })]);

          const events0 = await this.Event.findAll({
            where: {
              json: {
                lastLogin: now
              }
            }
          });

          const event0 = events0[0];

          expect(events0.length).to.equal(1);
          expect(event0.get('json')).to.eql({
            user: 'Homer',
            lastLogin: now.toISOString()
          });

          const events = await this.Event.findAll({
            where: {
              json: {
                lastLogin: { [Op.between]: [before, after] }
              }
            }
          });

          const event = events[0];

          expect(events.length).to.equal(1);
          expect(event.get('json')).to.eql({
            user: 'Homer',
            lastLogin: now.toISOString()
          });
        });

        it('should be possible to query a boolean with array operators', async function() {
          await Promise.all([this.Event.create({
            json: {
              user: 'Homer',
              active: true
            }
          })]);

          const events0 = await this.Event.findAll({
            where: {
              json: {
                active: true
              }
            }
          });

          const event0 = events0[0];

          expect(events0.length).to.equal(1);
          expect(event0.get('json')).to.eql({
            user: 'Homer',
            active: true
          });

          const events = await this.Event.findAll({
            where: {
              json: {
                active: { [Op.in]: [true, false] }
              }
            }
          });

          const event = events[0];

          expect(events.length).to.equal(1);
          expect(event.get('json')).to.eql({
            user: 'Homer',
            active: true
          });
        });

        it('should be possible to query a nested integer value', async function() {
          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              age: 40
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              age: 37
            }
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                age: {
                  [Op.gt]: 38
                }
              }
            }
          });

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

        it('should be possible to query a nested null value', async function() {
          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: null
            }
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                employment: null
              }
            }
          });

          expect(events.length).to.equal(1);
          expect(events[0].get('data')).to.eql({
            name: {
              first: 'Marge',
              last: 'Simpson'
            },
            employment: null
          });
        });

        it('should be possible to query for nested fields with hyphens/dashes, #8718', async function() {
          await Promise.all([this.Event.create({
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
          }), this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: null
            }
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                status_report: {
                  'red-indicator': {
                    'level$$level': true
                  }
                }
              }
            }
          });

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

        it('should be possible to query multiple nested values', async function() {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          });

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Bart',
                last: 'Simpson'
              },
              employment: 'None'
            }
          })]);

          const events = await this.Event.findAll({
            where: {
              data: {
                name: {
                  last: 'Simpson'
                },
                employment: {
                  [Op.ne]: 'None'
                }
              }
            },
            order: [
              ['id', 'ASC']
            ]
          });

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

        it('should be possible to query a nested value and order results', async function() {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          });

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Bart',
                last: 'Simpson'
              },
              employment: 'None'
            }
          })]);

          const events = await this.Event.findAll({
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
          });

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

      describe('destroy', () => {
        it('should be possible to destroy with where', async function() {
          const conditionSearch = {
            where: {
              data: {
                employment: 'Hacker'
              }
            }
          };

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Elliot',
                last: 'Alderson'
              },
              employment: 'Hacker'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Christian',
                last: 'Slater'
              },
              employment: 'Hacker'
            }
          }), this.Event.create({
            data: {
              name: {
                first: ' Tyrell',
                last: 'Wellick'
              },
              employment: 'CTO'
            }
          })]);

          await expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(2);
          await this.Event.destroy(conditionSearch);

          await expect(this.Event.findAll(conditionSearch)).to.eventually.have.length(0);
        });
      });

      describe('sql injection attacks', () => {
        beforeEach(async function() {
          this.Model = this.sequelize.define('Model', {
            data: DataTypes.JSON
          });
          await this.sequelize.sync({ force: true });
        });

        it('should properly escape the single quotes', async function() {
          await this.Model.create({
            data: {
              type: 'Point',
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- "
              }
            }
          });
        });

        it('should properly escape path keys', async function() {
          await this.Model.findAll({
            raw: true,
            attributes: ['id'],
            where: {
              data: {
                "a')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- ": 1
              }
            }
          });
        });

        it('should properly escape path keys with sequelize.json', async function() {
          await this.Model.findAll({
            raw: true,
            attributes: ['id'],
            where: this.sequelize.json("data.id')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- ", '1')
          });
        });

        it('should properly escape the single quotes in array', async function() {
          await this.Model.create({
            data: {
              type: 'Point',
              coordinates: [39.807222, "'); DELETE YOLO INJECTIONS; --"]
            }
          });
        });

        it('should be possible to find with properly escaped select query', async function() {
          await this.Model.create({
            data: {
              type: 'Point',
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- "
              }
            }
          });

          const result = await this.Model.findOne({
            where: {
              data: {
                type: 'Point',
                properties: {
                  exploit: "'); DELETE YOLO INJECTIONS; -- "
                }
              }
            }
          });

          expect(result.get('data')).to.deep.equal({
            type: 'Point',
            properties: {
              exploit: "'); DELETE YOLO INJECTIONS; -- "
            }
          });
        });

        it('should query an instance with JSONB data and order while trying to inject', async function() {
          await this.Event.create({
            data: {
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            }
          });

          await Promise.all([this.Event.create({
            data: {
              name: {
                first: 'Marge',
                last: 'Simpson'
              },
              employment: 'Housewife'
            }
          }), this.Event.create({
            data: {
              name: {
                first: 'Bart',
                last: 'Simpson'
              },
              employment: 'None'
            }
          })]);

          if (current.options.dialect === 'sqlite') {
            const events = await this.Event.findAll({
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
            });

            expect(events).to.be.ok;
            expect(events[0].get('data')).to.eql({
              name: {
                first: 'Homer',
                last: 'Simpson'
              },
              employment: 'Nuclear Safety Inspector'
            });
            return;
          }
          if (current.options.dialect === 'postgres') {
            await expect(this.Event.findAll({
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
  }

});
